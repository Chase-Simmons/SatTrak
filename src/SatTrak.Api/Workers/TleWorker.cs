using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SatTrak.Core.Services;

namespace SatTrak.Api.Workers;

public class TleWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ITleCache _tleCache;
    private readonly ILogger<TleWorker> _logger;
    private readonly TimeSpan _refreshInterval = TimeSpan.FromHours(6);

    public TleWorker(IServiceProvider serviceProvider, ITleCache tleCache, ILogger<TleWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _tleCache = tleCache;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("TLE Worker started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using (var scope = _serviceProvider.CreateScope())
                {
                    var fetcher = scope.ServiceProvider.GetRequiredService<ITleFetcherService>();
                    var tles = await fetcher.FetchActiveSatellitesAsync();
                    
                    _tleCache.Update(tles);
                    _logger.LogInformation("TLE Worker refreshed data. Count: {Count}", tles.Count);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in TleWorker.");
            }

            await Task.Delay(_refreshInterval, stoppingToken);
        }
    }
}
