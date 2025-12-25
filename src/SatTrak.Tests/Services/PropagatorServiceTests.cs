using System;
using Xunit;
using Moq;
using Microsoft.Extensions.Logging;
using SatTrak.Core.Services;
using SatTrak.Core.Domain;

namespace SatTrak.Tests.Services;

public class PropagatorServiceTests
{
    private readonly PropagatorService _service;
    private readonly Mock<ILogger<PropagatorService>> _mockLogger;

    public PropagatorServiceTests()
    {
        _mockLogger = new Mock<ILogger<PropagatorService>>();
        _service = new PropagatorService(_mockLogger.Object);
    }

    [Fact]
    public void Propagate_ValidTLE_ReturnsState()
    {
        // ARRANGE
        // ISS (ZARYA) TLE from a past date (or generic valid TLE)
        string line1 = "1 25544U 98067A   20353.53816694  .00001262  00000-0  30730-4 0  9997";
        string line2 = "2 25544  51.6442  20.4891 0001550 216.5160 218.4682 15.49168436260851";
        DateTime targetTime = new DateTime(2020, 12, 18, 12, 55, 0, DateTimeKind.Utc);

        // ACT
        var result = _service.Propagate(line1, line2, targetTime);

        // ASSERT
        Assert.NotNull(result);
        Assert.NotNull(result.Position);
        Assert.NotNull(result.Velocity);
        
        // Sanity check: ISS is usually ~6700-6800 km from Earth center (Earth R ~6371 + 400km alt)
        // Position magnitude
        double dist = Math.Sqrt(result.Position.X * result.Position.X + 
                                result.Position.Y * result.Position.Y + 
                                result.Position.Z * result.Position.Z);
        
        Assert.True(dist > 6500 && dist < 7000, $"Expected ISS altitude range. Got radius {dist} km");
    }

    [Fact]
    public void Propagate_InvalidTLE_ThrowsArgumentException()
    {
        Assert.Throws<ArgumentException>(() => _service.Propagate("", "", DateTime.UtcNow));
    }
}
