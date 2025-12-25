using SatTrak.Core.Domain;
using Xunit;

namespace SatTrak.Tests.Domain;

public class Vector3DTests
{
    [Fact]
    public void Constructor_SetsPropertiesCorrectly()
    {
        // Arrange
        double x = 1.1;
        double y = 2.2;
        double z = 3.3;

        // Act
        var vector = new Vector3D(x, y, z);

        // Assert
        Assert.Equal(x, vector.X);
        Assert.Equal(y, vector.Y);
        Assert.Equal(z, vector.Z);
    }

    [Fact]
    public void ToString_FormatsCorrectly()
    {
        // Arrange
        var vector = new Vector3D(1.2345, 5.6789, 9.0123);

        // Act
        var result = vector.ToString();

        // Assert
        Assert.Equal("(1.234, 5.679, 9.012)", result);
    }
}
