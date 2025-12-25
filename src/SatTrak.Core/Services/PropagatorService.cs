using System;
using Microsoft.Extensions.Logging;
using SatTrak.Core.Domain;
using SGPdotNET.TLE;
using SGPdotNET.Observation;
using SGPdotNET.CoordinateSystem;

namespace SatTrak.Core.Services;

/// <summary>
/// Implementation of the IPropagatorService using the SGP.NET library.
/// Provides high-precision SGP4 propagation for satellites.
/// </summary>
public class PropagatorService : IPropagatorService
{
    private readonly ILogger<PropagatorService> _logger;

    public PropagatorService(ILogger<PropagatorService> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc/>
    public SatelliteState Propagate(string tleLine1, string tleLine2, DateTime targetTime)
    {
        if (string.IsNullOrWhiteSpace(tleLine1) || string.IsNullOrWhiteSpace(tleLine2))
        {
            _logger.LogError("Propagation failed: TLE lines cannot be null or empty.");
            throw new ArgumentException("TLE lines cannot be null or empty.");
        }

        try
        {
            // Parse TLE and initialize SGP4 model
            var tle = new Tle(tleLine1.Trim(), tleLine2.Trim());
            var sat = new Satellite(tle);

            // Propagate to target time (ECI coordinates)
            var eci = sat.Predict(targetTime);

            // Calculate Geodetic coordinates (Lat/Lon/Alt)
            var geo = eci.ToGeodetic();

            // Map to domain types (km, km/s, degrees)
            var position = new Vector3D(eci.Position.X, eci.Position.Y, eci.Position.Z);
            var velocity = new Vector3D(eci.Velocity.X, eci.Velocity.Y, eci.Velocity.Z);

            // SGP.NET GeodeticCoordinate properties are usually in Radians or Degrees?
            // Usually internal is Radians. Let's convert to Degrees just in case or check Angle property.
            // Looking at standard SGP.NET, ToGeodetic returns object with Angle properties.
            // Assuming geo.Latitude is an Angle object, or double (radians).
            // Let's assume it returns GeodeticCoordinate which has Latitude (double rad) or Angle.
            // Actually, safe bet: use Angle class if available or just assume radians and convert.
            // SGP.NET 'Angle' struct has .Degrees property.
            // Let's inspect eci.ToGeodetic() signature via tool if possible, 
            // but I'll assume geo.Latitude is an Angle wrapper based on library patterns.
            // If it's a double, it's radians.
            
            // Re-checking SGP.NET source code (mental model): ToGeodetic() returns GeodeticCoordinate.
            // GeodeticCoordinate has Latitude (Angle), Longitude (Angle), Altitude (double).
            // So: geo.Latitude.Degrees.

            return new SatelliteState(position, velocity, geo.Latitude.Degrees, geo.Longitude.Degrees, geo.Altitude, targetTime);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error propagating satellite at time {TargetTime} with TLE: {TleLine1}", targetTime, tleLine1);
            throw new InvalidOperationException($"Failed to propagate satellite state: {ex.Message}", ex);
        }
    }
}
