import WebSocket from 'ws';
import pool from './db.js';

// Setup timeout safety
const timeoutId = setTimeout(() => {
  console.error('❌ E2E TEST TIMEOUT: Test did not finish in 15 seconds.');
  process.exit(1);
}, 15000);

async function runE2ETest() {
  console.log('🏁 STARTING END-TO-END A2Z BOOKING SIGNALING TEST...');

  const rideId = 'e2e_test_ride_' + Math.random().toString(36).substr(2, 9);
  const passengerPhone = '9999999999';
  const driverId = 'drv_1';

  // Setup database connection check first
  try {
    const dbCheck = await pool.query('SELECT name, verification_status FROM drivers WHERE id = $1', [driverId]);
    if (dbCheck.rows.length === 0) {
      console.warn('⚠️ WARNING: Driver drv_1 is not seeded in the database. E2E test might fail db lookups.');
    } else {
      console.log(`📡 DB Verified: Found driver "${dbCheck.rows[0].name}" (KYC: ${dbCheck.rows[0].verification_status})`);
    }

    // Insert mock passenger to pass rides table foreign key constraint
    await pool.query(
      `INSERT INTO passengers (phone, name, wallet_balance) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (phone) DO UPDATE SET wallet_balance = 1000.00`,
      [passengerPhone, 'E2E Test Passenger', 1000.00]
    );
    console.log('👤 DB Verified: Mock passenger account created/updated.');
  } catch (err) {
    console.error('❌ Database pre-requisites check failed:', err.message);
    clearTimeout(timeoutId);
    await pool.end();
    process.exit(1);
  }

  // Connect sockets to the local backend server
  const serverUrl = 'ws://localhost:5001';
  console.log(`🔌 Connecting to local dispatch server: ${serverUrl}`);
  
  const passengerWs = new WebSocket(serverUrl);
  const driverWs = new WebSocket(serverUrl);

  let passengerRegistered = false;
  let driverRegistered = false;
  let offerReceivedByDriver = false;
  let rideAcceptedByPassenger = false;

  const cleanUp = async (success) => {
    clearTimeout(timeoutId);
    passengerWs.close();
    driverWs.close();
    
    // Clean up E2E DB logs
    try {
      await pool.query('DELETE FROM rides WHERE id = $1', [rideId]);
      await pool.query('DELETE FROM passengers WHERE phone = $1', [passengerPhone]);
      console.log('🧹 DB Cleaned: Removed E2E test entries.');
    } catch (cleanErr) {
      console.warn('⚠️ DB Cleanup failed:', cleanErr.message);
    }

    await pool.end();
    if (success) {
      console.log('✅ ALL E2E BOOKING CHECKS PASSED SUCCESSFULLY!');
      process.exit(0);
    } else {
      console.error('❌ E2E TEST FAILED.');
      process.exit(1);
    }
  };

  // 1. Setup Passenger Socket listeners
  passengerWs.on('open', () => {
    console.log('➡️ Passenger WebSocket connected. Registering...');
    passengerWs.send(JSON.stringify({
      type: 'register',
      role: 'passenger',
      id: passengerPhone
    }));
  });

  passengerWs.on('message', async (data) => {
    const msg = JSON.parse(data);
    console.log(`[Passenger WS Received] type: ${msg.type}`);

    if (msg.type === 'registered') {
      passengerRegistered = true;
      checkStartBooking();
    } else if (msg.type === 'ride_accepted') {
      console.log('🎉 Passenger notified: Ride has been ACCEPTED by driver!');
      rideAcceptedByPassenger = true;
      
      // Simulate driver status progression after passenger receives acceptance
      setTimeout(() => {
        console.log('➡️ Driver simulating: ARRIVED at pickup...');
        driverWs.send(JSON.stringify({
          type: 'update_ride_status',
          rideId: rideId,
          status: 'arrived',
          passengerPhone: passengerPhone
        }));
      }, 1000);
    } else if (msg.type === 'ride_status_broadcast') {
      console.log(`🔔 Passenger Status Broadcast: Ride is now "${msg.status.toUpperCase()}"`);
      
      if (msg.status === 'arrived') {
        setTimeout(() => {
          console.log('➡️ Driver simulating: STARTING trip (in_progress)...');
          driverWs.send(JSON.stringify({
            type: 'update_ride_status',
            rideId: rideId,
            status: 'in_progress',
            passengerPhone: passengerPhone
          }));
        }, 1000);
      } else if (msg.status === 'in_progress') {
        setTimeout(() => {
          console.log('➡️ Driver simulating: COMPLETING trip...');
          driverWs.send(JSON.stringify({
            type: 'update_ride_status',
            rideId: rideId,
            status: 'completed',
            passengerPhone: passengerPhone
          }));
        }, 1000);
      } else if (msg.status === 'completed') {
        console.log('🏁 Passenger received completion broadcast.');
        // Verify database updates
        setTimeout(async () => {
          try {
            const dbCheck = await pool.query('SELECT status FROM rides WHERE id = $1', [rideId]);
            if (dbCheck.rows.length > 0 && dbCheck.rows[0].status === 'completed') {
              console.log('💾 Database check: Ride status in DB is correctly marked as "completed"!');
              await cleanUp(true);
            } else {
              console.error('❌ DB Verification failed. Ride not found or status is not "completed".');
              await cleanUp(false);
            }
          } catch (dbErr) {
            console.error('❌ DB verification error:', dbErr.message);
            await cleanUp(false);
          }
        }, 1000);
      }
    }
  });

  // 2. Setup Driver Socket listeners
  driverWs.on('open', () => {
    console.log('➡️ Driver WebSocket connected. Registering...');
    driverWs.send(JSON.stringify({
      type: 'register',
      role: 'driver',
      id: driverId
    }));
  });

  driverWs.on('message', (data) => {
    const msg = JSON.parse(data);
    console.log(`[Driver WS Received] type: ${msg.type}`);

    if (msg.type === 'registered') {
      driverRegistered = true;
      checkStartBooking();
    } else if (msg.type === 'ride_offer') {
      console.log('🎁 Driver received ride offer request contract!');
      offerReceivedByDriver = true;
      
      // Accept the offer
      setTimeout(() => {
        console.log('➡️ Driver sending: ACCEPT ride offer...');
        driverWs.send(JSON.stringify({
          type: 'driver_accept',
          rideId: rideId,
          passengerPhone: passengerPhone
        }));
      }, 1000);
    }
  });

  const checkStartBooking = () => {
    if (passengerRegistered && driverRegistered) {
      console.log('🚀 Both devices registered. Dispatching "book_ride" request from Passenger...');
      passengerWs.send(JSON.stringify({
        type: 'book_ride',
        ride: {
          id: rideId,
          passengerPhone: passengerPhone,
          driverId: driverId,
          pickupName: 'Sector V, Salt Lake',
          pickup: { lat: 22.5735, lng: 88.4331 },
          dropoffName: 'Science City, Kolkata',
          dropoff: { lat: 22.5392, lng: 88.3970 },
          paymentMethod: 'wallet',
          vehicleType: 'car_ac',
          distance: 5.2,
          totalFare: 150.00,
          takeHome: 135.00,
          commission: 15.00,
          gstAmount: 7.50,
          insurancePremium: 2.00,
          contractHash: '0xabc123e2e',
          surgeMultiplier: 1.0,
          status: 'searching'
        }
      }));
    }
  };
}

runE2ETest().catch(async (err) => {
  console.error('Fatal E2E runner error:', err);
  process.exit(1);
});
