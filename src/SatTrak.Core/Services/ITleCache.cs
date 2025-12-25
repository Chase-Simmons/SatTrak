using System.Collections.Concurrent;
using System.Collections.Generic;
using SGPdotNET.TLE;

namespace SatTrak.Core.Services;

/// <summary>
/// Thread-safe cache for TLE data.
/// </summary>
public interface ITleCache
{
    void Update(Dictionary<int, Tle> tles);
    IEnumerable<Tle> GetAll();
}

public class CommandLineTleCache : ITleCache
{
    // Using ConcurrentDictionary or just swapping reference for standard Dictionary since write is rare (every 6h).
    private Dictionary<int, Tle> _cache = new();
    private readonly object _lock = new();

    public void Update(Dictionary<int, Tle> tles)
    {
        lock (_lock)
        {
            _cache = tles;
        }
    }

    public IEnumerable<Tle> GetAll()
    {
        lock (_lock)
        {
            // Return copy or values
            return new List<Tle>(_cache.Values);
        }
    }
}
