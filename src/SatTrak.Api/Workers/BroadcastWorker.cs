using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SatTrak.Api.Hubs;
using SatTrak.Core.Domain;
using SatTrak.Core.Services;

namespace SatTrak.Api.Workers;

/// <summary>
/// High-frequency worker that propagates orbits and pushes updates to SignalR clients.
/// </summary>
public class BroadcastWorker : BackgroundService
{
    private readonly ITleCache _tleCache;
    private readonly IPropagatorService _propagatorService;
    private readonly IHubContext<SatelliteHub> _hubContext;
    private readonly ILogger<BroadcastWorker> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromMilliseconds(100); // 10Hz

    public BroadcastWorker(
        ITleCache tleCache,
        IPropagatorService propagatorService,
        IHubContext<SatelliteHub> hubContext,
        ILogger<BroadcastWorker> logger)
    {
        _tleCache = tleCache;
        _propagatorService = propagatorService;
        _hubContext = hubContext;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Broadcast Worker started at 10Hz.");

        // Limit broadcast to 100 satellites to minimize bandwidth during MVP phase.
        
        while (!stoppingToken.IsCancellationRequested)
        {
            var start = DateTime.UtcNow;
            
            try
            {
                var allTles = _tleCache.GetAll().Take(100).ToList(); 
                
                if (allTles.Any())
                {
                    var updates = new List<object>(); 
                    var now = DateTime.UtcNow;
                    
                    foreach (var tle in allTles)
                    {
                        try
                        {
                            var state = _propagatorService.Propagate(tle.Line1, tle.Line2, now);
                            
                            updates.Add(new 
                            { 
                                Id = (int)tle.NoradNumber,
                                Name = tle.Name,
                                Pos = new { state.Position.X, state.Position.Y, state.Position.Z },
                                Vel = new { state.Velocity.X, state.Velocity.Y, state.Velocity.Z },
                                Time = state.Timestamp,
                                Lat = state.Latitude,
                                Lon = state.Longitude,
                                Alt = state.Altitude
                            });
                        }
                        catch
                        {
                            // buffer errors
                        }
                    }

                    // Broadcast
                    await _hubContext.Clients.All.SendAsync("ReceiveSatelliteUpdates", updates, stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Broadcast loop.");
            }

            var elapsed = DateTime.UtcNow - start;
            var delay = _interval - elapsed;
            if (delay > TimeSpan.Zero)
            {
                await Task.Delay(delay, stoppingToken);
            }
        }
    }
}
