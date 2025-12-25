using System;

namespace SatTrak.Core.Domain;

/// <summary>
/// Represents the state of a satellite at a specific point in time.
/// Includes Position and Velocity in the ECI (Earth-Centered Inertial) frame.
/// </summary>
public class SatelliteState
{


    public Vector3D Position { get; } // ECI
    public Vector3D Velocity { get; } // ECI
    public double Latitude { get; }   // Degrees
    public double Longitude { get; }  // Degrees
    public double Altitude { get; }   // km
    public DateTime Timestamp { get; }

    public SatelliteState(Vector3D position, Vector3D velocity, double lat, double lon, double alt, DateTime timestamp)
    {
        Position = position;
        Velocity = velocity;
        Latitude = lat;
        Longitude = lon;
        Altitude = alt;
        Timestamp = timestamp;
    }
}
