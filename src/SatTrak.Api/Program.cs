using SatTrak.Api.Hubs;
using SatTrak.Api.Workers;
using SatTrak.Core.Services;
using SatTrak.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Register Services
builder.Services.AddSingleton<ITleCache, CommandLineTleCache>();
builder.Services.AddTransient<IPropagatorService, PropagatorService>();
builder.Services.AddHttpClient<ITleFetcherService, TleFetcherService>();
builder.Services.AddHostedService<TleWorker>();
builder.Services.AddHostedService<BroadcastWorker>();
builder.Services.AddSignalR();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowFrontend");

// app.UseHttpsRedirection(); // Disable for local dev with HTTP frontend

app.UseAuthorization();

app.MapControllers();
app.MapHub<SatelliteHub>("/satelliteHub");

app.Run();
