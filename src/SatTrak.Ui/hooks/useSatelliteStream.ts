import { useEffect, useState } from "react";
import * as signalR from "@microsoft/signalr";

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface SatelliteDto {
    id: number;
    name: string;
    pos: Vector3;
    vel: Vector3;
    time: string;
    lat: number;
    lon: number;
    alt: number;
}

export const useSatelliteStream = () => {
    const [satellites, setSatellites] = useState<SatelliteDto[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");

    useEffect(() => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5279";
        
        const connection = new signalR.HubConnectionBuilder()
            .withUrl(`${apiUrl}/satelliteHub`)
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        connection.on("ReceiveSatelliteUpdates", (updates: SatelliteDto[]) => {
            setSatellites(updates);
        });

        let isMounted = true;

        const startConnection = async () => {
            try {
                await connection.start();
                if (isMounted) setConnectionStatus("Connected");
            } catch (err: any) {
                // Ignore "stopped during negotiation" error (common in React Strict Mode)
                if (err?.toString().includes("stopped during negotiation")) {
                    return;
                }
                
                if (isMounted) {
                    console.error("SignalR Connection Error: ", err);
                    setConnectionStatus("Error");
                }
            }
        };

        startConnection();

        return () => {
            isMounted = false;
            connection.stop().catch(() => {}); // Ignore errors on stop
        };
    }, []);

    return { satellites, connectionStatus };
};
