using System.Collections.Generic;
using System.Threading.Tasks;
using SGPdotNET.TLE;

namespace SatTrak.Core.Services;

/// <summary>
/// Service responsible for fetching Two-Line Element (TLE) sets from an external source.
/// </summary>
public interface ITleFetcherService
{
    /// <summary>
    /// Fetches the latest TLE data for active satellites.
    /// </summary>
    /// <returns>A dictionary of TLEs keyed by Satellite Catalog Number (NORAD ID).</returns>
    Task<Dictionary<int, Tle>> FetchActiveSatellitesAsync();
}
