package com.joldigo.app

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Color
import android.location.Location
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import com.google.android.gms.location.*
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.MapView
import com.google.android.gms.maps.OnMapReadyCallback
import com.google.android.gms.maps.model.*

class JaldiGoMapActivity : AppCompatActivity(), OnMapReadyCallback {

    private lateinit var mapView: MapView
    private var googleMap: GoogleMap? = null
    private lateinit var locationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback

    private var vehicleMarker: Marker? = null
    private var activeRoutePolyline: Polyline? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Programmatic full-screen layout setup
        val rootLayout = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        
        mapView = MapView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        
        rootLayout.addView(mapView)
        setContentView(rootLayout)

        mapView.onCreate(savedInstanceState)
        mapView.getMapAsync(this)

        locationClient = LocationServices.getFusedLocationProviderClient(this)
        setupLocationCallback()
    }

    override fun onMapReady(map: GoogleMap) {
        googleMap = map
        
        // Enable traffic view layer
        googleMap?.isTrafficEnabled = true

        // Center on Kolkata default coordinates
        val defaultLatLng = LatLng(22.5726, 88.3639)
        googleMap?.moveCamera(CameraUpdateFactory.newLatLngZoom(defaultLatLng, 15f))

        checkLocationPermissionsAndStart()
        drawSampleRoute()
    }

    private fun setupLocationCallback() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val lastLocation = result.lastLocation ?: return
                updateVehiclePositionSmoothly(lastLocation)
            }
        }
    }

    private fun checkLocationPermissionsAndStart() {
        val fineLocationPermission = ActivityCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_FINE_LOCATION
        )
        val coarseLocationPermission = ActivityCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_COARSE_LOCATION
        )

        if (fineLocationPermission != PackageManager.PERMISSION_GRANTED ||
            coarseLocationPermission != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                LOCATION_PERMISSION_REQUEST_CODE
            )
        } else {
            startLocationUpdates()
        }
    }

    private fun startLocationUpdates() {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 2000L).apply {
            setMinUpdateIntervalMillis(1000L)
            setWaitForAccurateLocation(true)
        }.build()

        try {
            locationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
            googleMap?.isMyLocationEnabled = false // using custom vehicle marker instead
        } catch (e: SecurityException) {
            Toast.makeText(this, "Permission denied: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun updateVehiclePositionSmoothly(newLocation: Location) {
        val map = googleMap ?: return
        val targetLatLng = LatLng(newLocation.latitude, newLocation.longitude)

        if (vehicleMarker == null) {
            // Setup custom vehicle pointer marker
            val descriptor = BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_AZURE)
            val options = MarkerOptions()
                .position(targetLatLng)
                .icon(descriptor)
                .anchor(0.5f, 0.5f)
                .title("Jaldi Go Driver (Native)")
            
            vehicleMarker = map.addMarker(options)
            map.animateCamera(CameraUpdateFactory.newLatLngZoom(targetLatLng, 16f))
        } else {
            // Smoothly interpolate marker from current position to new position
            animateMarkerTo(vehicleMarker!!, targetLatLng)
            map.animateCamera(CameraUpdateFactory.newLatLng(targetLatLng))
        }
    }

    private fun animateMarkerTo(marker: Marker, targetPosition: LatLng) {
        val handler = Handler(Looper.getMainLooper())
        val start = System.currentTimeMillis()
        val duration = 1000L
        val startPosition = marker.position

        handler.post(object : Runnable {
            override fun run() {
                val elapsed = System.currentTimeMillis() - start
                val t = Math.min(1f, elapsed.toFloat() / duration)
                
                // Linear interpolation (lerp)
                val lat = startPosition.latitude + (targetPosition.latitude - startPosition.latitude) * t
                val lng = startPosition.longitude + (targetPosition.longitude - startPosition.longitude) * t
                marker.position = LatLng(lat, lng)

                if (t < 1.0f) {
                    handler.postDelayed(this, 16)
                }
            }
        })
    }

    private fun drawSampleRoute() {
        val map = googleMap ?: return
        val routeOptions = PolylineOptions()
            .add(LatLng(22.5726, 88.3639))
            .add(LatLng(22.5745, 88.3660))
            .add(LatLng(22.5760, 88.3710))
            .add(LatLng(22.5800, 88.3750))
            .color(Color.BLUE)
            .width(12f)
            .jointType(JointType.ROUND)
            .startCap(RoundCap())
            .endCap(RoundCap())

        activeRoutePolyline = map.addPolyline(routeOptions)
    }

    override fun onResume() {
        super.onResume()
        mapView.onResume()
    }

    override fun onPause() {
        super.onPause()
        mapView.onPause()
    }

    override fun onDestroy() {
        super.onDestroy()
        mapView.onDestroy()
        locationClient.removeLocationUpdates(locationCallback)
    }

    override fun onLowMemory() {
        super.onLowMemory()
        mapView.onLowMemory()
    }

    companion object {
        private const val LOCATION_PERMISSION_REQUEST_CODE = 5001
    }
}
