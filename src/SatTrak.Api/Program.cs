using SatTrak.Api.Hubs;
using SatTrak.Api.Workers;
using SatTrak.Core.Services;
using SatTrak.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// --- SatTrak Services ---

// Core Services
builder.Services.AddSingleton<ITleCache, CommandLineTleCache>();
builder.Services.AddTransient<IPropagatorService, PropagatorService>();

// Infrastructure Services
builder.Services.AddHttpClient<ITleFetcherService, TleFetcherService>();

// Background Workers
builder.Services.AddHostedService<TleWorker>();
builder.Services.AddHostedService<BroadcastWorker>();

// SignalR
builder.Services.AddSignalR();

// CORS (Allow Frontend)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy.WithOrigins("http://localhost:3000") // Next.js default
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

app.UseHttpsRedirection();

app.UseCors("AllowFrontend");

app.UseAuthorization();

app.MapControllers();
app.MapHub<SatelliteHub>("/satelliteHub");

app.Run();
