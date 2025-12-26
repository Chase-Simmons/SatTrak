using System;
using Microsoft.Extensions.Logging;
using SatTrak.Core.Services;

namespace SatTrak.Cli;

class Program
{
    static void Main(string[] args)
    {
        using var loggerFactory = LoggerFactory.Create(builder =>
        {
            builder
                .AddFilter("Microsoft", LogLevel.Warning)
                .AddFilter("System", LogLevel.Warning)
                .AddConsole();
        });
        
        var logger = loggerFactory.CreateLogger<PropagatorService>();
        var propagator = new PropagatorService(logger);

        string line1 = "1 25544U 98067A   24357.51862551  .00010959  00000+0  20040-3 0  9997";
        string line2 = "2 25544  51.6396 226.7936 0005527 241.2238 238.9056 15.49654763488056";

        Console.WriteLine($"[TLE Line 1] {line1}");
        Console.WriteLine($"[TLE Line 2] {line2}");
        Console.WriteLine();

        Console.WriteLine("Propagating ISS position (Press CTRL+C to stop)...");

        while (true)
        {
            try
            {
                var now = DateTime.UtcNow;
                var state = propagator.Propagate(line1, line2, now);

                Console.SetCursorPosition(0, Console.CursorTop);
                Console.Write($"[UTC {state.Timestamp:HH:mm:ss.fff}] Pos: {state.Position} km | Vel: {state.Velocity} km/s    ");
                
                System.Threading.Thread.Sleep(500);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error: {ex.Message}");
                break;
            }
        }
    }
}
