import UIKit
import GoogleMaps
import CoreLocation

class JaldiGoMapViewController: UIViewController, CLLocationManagerDelegate {

    private var mapView: GMSMapView!
    private var locationManager: CLLocationManager!
    private var vehicleMarker: GMSMarker?
    private var routePolyline: GMSPolyline?

    override func viewDidLoad() {
        super.viewDidLoad()

        // Initialize Google Maps view camera centered on default coordinates (Kolkata)
        let camera = GMSCameraPosition.camera(withLatitude: 22.5726, longitude: 88.3639, zoom: 15.0)
        mapView = GMSMapView.map(withFrame: self.view.bounds, camera: camera)
        
        // Enable traffic view layer
        mapView.isTrafficEnabled = true
        
        self.view.addSubview(mapView)
        
        // Constrain MapView to fill root view
        mapView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            mapView.topAnchor.constraint(equalTo: view.topAnchor),
            mapView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            mapView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            mapView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])

        setupLocationManager()
        drawSampleRoute()
    }

    private func setupLocationManager() {
        locationManager = CLLocationManager()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        locationManager.distanceFilter = 2.0 // Update every 2 meters
        
        // Request background tracking capabilities
        locationManager.requestAlwaysAuthorization()
        
        // Background updates permissions configuration
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
        
        locationManager.startUpdatingLocation()
    }

    // CLLocationManagerDelegate implementation
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let lastLocation = locations.last else { return }
        updateVehiclePositionSmoothly(to: lastLocation.coordinate)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("GPS Tracking error: \(error.localizedDescription)")
    }

    private func updateVehiclePositionSmoothly(to coordinate: CLLocationCoordinate2D) {
        let camera = GMSCameraUpdate.setTarget(coordinate)
        mapView.animate(with: camera)

        if vehicleMarker == nil {
            // Setup custom vehicle GMSMarker
            let marker = GMSMarker(position: coordinate)
            marker.title = "Jaldi Go Driver (Native)"
            marker.icon = GMSMarker.markerImage(with: .blue)
            marker.groundAnchor = CGPoint(x: 0.5, y: 0.5)
            marker.map = mapView
            vehicleMarker = marker
        } else {
            // Smoothly animate coordinate updates using CoreAnimation Transaction
            CATransaction.begin()
            CATransaction.setAnimationDuration(1.0)
            vehicleMarker?.position = coordinate
            CATransaction.commit()
        }
    }

    private func drawSampleRoute() {
        let path = GMSMutablePath()
        path.add(CLLocationCoordinate2D(latitude: 22.5726, longitude: 88.3639))
        path.add(CLLocationCoordinate2D(latitude: 22.5745, longitude: 88.3660))
        path.add(CLLocationCoordinate2D(latitude: 22.5760, longitude: 88.3710))
        path.add(CLLocationCoordinate2D(latitude: 22.5800, longitude: 88.3750))

        let polyline = GMSPolyline(path: path)
        polyline.strokeColor = .blue
        polyline.strokeWidth = 6.0
        polyline.map = mapView
        
        routePolyline = polyline
    }
}
