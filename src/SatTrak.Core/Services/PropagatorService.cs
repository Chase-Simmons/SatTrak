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
            var tle = new Tle(tleLine1.Trim(), tleLine2.Trim());
            var sat = new Satellite(tle);
            var eci = sat.Predict(targetTime);
            var geo = eci.ToGeodetic();

            var position = new Vector3D(eci.Position.X, eci.Position.Y, eci.Position.Z);
            var velocity = new Vector3D(eci.Velocity.X, eci.Velocity.Y, eci.Velocity.Z);

            return new SatelliteState(position, velocity, geo.Latitude.Degrees, geo.Longitude.Degrees, geo.Altitude, targetTime);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error propagating satellite at time {TargetTime} with TLE: {TleLine1}", targetTime, tleLine1);
            throw new InvalidOperationException($"Failed to propagate satellite state: {ex.Message}", ex);
        }
    }
}
