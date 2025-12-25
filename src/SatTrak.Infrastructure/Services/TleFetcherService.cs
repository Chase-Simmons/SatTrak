using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using SGPdotNET.TLE;

namespace SatTrak.Infrastructure.Services;

/// <summary>
/// Implementation of ITleFetcherService that downloads TLEs from CelesTrak.
/// </summary>
public class TleFetcherService : SatTrak.Core.Services.ITleFetcherService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<TleFetcherService> _logger;
    private const string StarlinkUrl = "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle";

    public TleFetcherService(HttpClient httpClient, ILogger<TleFetcherService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<Dictionary<int, Tle>> FetchActiveSatellitesAsync()
    {
        _logger.LogInformation("Fetching TLE data from {Url}", StarlinkUrl);

        try
        {
            // Download Content
            var response = await _httpClient.GetStringAsync(StarlinkUrl);
            var lines = response.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);

            var tles = new Dictionary<int, Tle>();

            // Parse CelesTrak GP TLE format (3 lines per satellite: Name, Line1, Line2)
            for (int i = 0; i < lines.Length; i += 3)
            {
                if (i + 2 >= lines.Length) break;

                var name = lines[i].Trim();
                var line1 = lines[i + 1].Trim();
                var line2 = lines[i + 2].Trim();

                try
                {
                    // Use standard 2-line constructor.
                    var tleObj = new Tle(line1, line2);
                    
                    if (!tles.ContainsKey((int)tleObj.NoradNumber))
                    {
                        tles.Add((int)tleObj.NoradNumber, tleObj);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("Failed to parse TLE for satellite {Name}: {Message}", name, ex.Message);
                }
            }

            _logger.LogInformation("Successfully fetched {Count} TLEs.", tles.Count);
            return tles;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching TLE data.");
            throw;
        }
    }
}
