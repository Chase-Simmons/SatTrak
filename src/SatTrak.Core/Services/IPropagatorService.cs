using System;
using SatTrak.Core.Domain;

namespace SatTrak.Core.Services;

/// <summary>
/// Service responsible for propagating satellite orbits using SGP4 logic.
/// </summary>
public interface IPropagatorService
{
    /// <summary>
    /// Calculates the Position and Velocity of a satellite at a given time.
    /// </summary>
    /// <param name="tleLine1">The first line of the TLE (Two-Line Element) set.</param>
    /// <param name="tleLine2">The second line of the TLE set.</param>
    /// <param name="targetTime">The target UTC time for propagation.</param>
    /// <returns>A <see cref="SatelliteState"/> containing Position (km) and Velocity (km/s).</returns>
    /// <exception cref="ArgumentException">Thrown if TLE lines are invalid.</exception>
    SatelliteState Propagate(string tleLine1, string tleLine2, DateTime targetTime);
}
