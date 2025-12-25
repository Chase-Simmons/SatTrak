using System;

namespace SatTrak.Core.Domain;

/// <summary>
/// Represents the state of a satellite at a specific point in time.
/// Includes Position and Velocity in the ECI (Earth-Centered Inertial) frame.
/// </summary>
public class SatelliteState
{
    /// <summary>
    /// The Position vector in km (ECI frame).
    /// </summary>
    public Vector3D Position { get; }

    /// <summary>
    /// The Velocity vector in km/s (ECI frame).
    /// </summary>
    public Vector3D Velocity { get; }

    /// <summary>
    /// The calculation timestamp (UTC).
    /// </summary>
    public DateTime Timestamp { get; }

    public SatelliteState(Vector3D position, Vector3D velocity, DateTime timestamp)
    {
        Position = position;
        Velocity = velocity;
        Timestamp = timestamp;
    }
}
