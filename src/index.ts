#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export class LTAServer {
  private server: Server;

  constructor() {
    this.server = new Server({
      name: "lta-datamall-server",
      version: "0.1.0"
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [{
          name: "bus_arrival",
          description: "Get real-time bus arrival information for a specific bus stop and optionally a specific service number. Returns estimated arrival times, bus locations, and crowding levels.",
          inputSchema: {
            type: "object",
            properties: {
              busStopCode: {
                type: "string",
                description: "The unique 5-digit bus stop code"
              },
              serviceNo: {
                type: "string",
                description: "Optional bus service number to filter results"
              }
            },
            required: ["busStopCode"]
          }
        },
        {
          name: "station_crowding",
          description: "Get real-time MRT/LRT station crowdedness level for a particular train network line. Updates every 10 minutes.",
          inputSchema: {
            type: "object",
            properties: {
              trainLine: {
                type: "string",
                description: "Code of train network line (CCL, CEL, CGL, DTL, EWL, NEL, NSL, BPL, SLRT, PLRT, TEL)",
                enum: ["CCL", "CEL", "CGL", "DTL", "EWL", "NEL", "NSL", "BPL", "SLRT", "PLRT", "TEL"]
              }
            },
            required: ["trainLine"]
          }
        },
        {
          name: "train_alerts",
          description: "Get real-time train service alerts including service disruptions and shuttle services. Updates when there are changes.",
          inputSchema: {
            type: "object",
            properties: {} // No parameters needed
          }
        },
        {
          name: "carpark_availability",
          description: "Get real-time availability of parking lots for HDB, LTA, and URA carparks. Updates every minute.",
          inputSchema: {
            type: "object",
            properties: {} // No parameters needed
          }
        },
        {
          name: "travel_times",
          description: "Get estimated travel times on expressway segments. Updates every 5 minutes.",
          inputSchema: {
            type: "object",
            properties: {} // No parameters needed
          }
        },
        {
          name: "traffic_incidents",
          description: "Get current road incidents including accidents, roadworks, and heavy traffic. Updates every 2 minutes.",
          inputSchema: {
            type: "object",
            properties: {} // No parameters needed
          }
        },
        {
          name: "station_crowd_forecast",
          description: "Get forecasted MRT/LRT station crowdedness levels in 30-minute intervals.",
          inputSchema: {
            type: "object",
            properties: {
              trainLine: {
                type: "string",
                description: "Code of train network line (CCL, CEL, CGL, DTL, EWL, NEL, NSL, BPL, SLRT, PLRT, TEL)",
                enum: ["CCL", "CEL", "CGL", "DTL", "EWL", "NEL", "NSL", "BPL", "SLRT", "PLRT", "TEL"]
              }
            },
            required: ["trainLine"]
          }
        }]
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case "bus_arrival": {
          const { busStopCode, serviceNo } = request.params.arguments as {
            busStopCode: string;
            serviceNo?: string;
          };

          try {
            const response = await axios.get('https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival', {
              params: {
                BusStopCode: busStopCode,
                ...(serviceNo && { ServiceNo: serviceNo })
              },
              headers: {
                'AccountKey': process.env.LTA_API_KEY!,
                'accept': 'application/json'
              }
            });
            
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          } catch (error) {
            if (axios.isAxiosError(error)) {
              return {
                content: [{
                  type: "text", 
                  text: `LTA API error: ${error.response?.data?.Message ?? error.message}`
                }],
                isError: true
              };
            }
            throw error;
          }
        }

        case "station_crowding": {
          const { trainLine } = request.params.arguments as {
            trainLine: string;
          };

          try {
            const response = await axios.get('https://datamall2.mytransport.sg/ltaodataservice/PCDRealTime', {
              params: {
                TrainLine: trainLine
              },
              headers: {
                'AccountKey': process.env.LTA_API_KEY!,
                'accept': 'application/json'
              }
            });
            
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          } catch (error) {
            if (axios.isAxiosError(error)) {
              return {
                content: [{
                  type: "text",
                  text: `LTA API error: ${error.response?.data?.Message ?? error.message}`
                }],
                isError: true
              };
            }
            throw error;
          }
        }

        case "train_alerts": {
          try {
            const response = await axios.get('https://datamall2.mytransport.sg/ltaodataservice/TrainServiceAlerts', {
              headers: {
                'AccountKey': process.env.LTA_API_KEY!,
                'accept': 'application/json'
              }
            });
            
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          } catch (error) {
            if (axios.isAxiosError(error)) {
              return {
                content: [{
                  type: "text",
                  text: `LTA API error: ${error.response?.data?.Message ?? error.message}`
                }],
                isError: true
              };
            }
            throw error;
          }
        }

        case "carpark_availability": {
          try {
            const response = await axios.get('https://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2', {
              headers: {
                'AccountKey': process.env.LTA_API_KEY!,
                'accept': 'application/json'
              }
            });
            
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          } catch (error) {
            if (axios.isAxiosError(error)) {
              return {
                content: [{
                  type: "text",
                  text: `LTA API error: ${error.response?.data?.Message ?? error.message}`
                }],
                isError: true
              };
            }
            throw error;
          }
        }

        case "travel_times": {
          try {
            const response = await axios.get('https://datamall2.mytransport.sg/ltaodataservice/EstTravelTimes', {
              headers: {
                'AccountKey': process.env.LTA_API_KEY!,
                'accept': 'application/json'
              }
            });
            
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          } catch (error) {
            if (axios.isAxiosError(error)) {
              return {
                content: [{
                  type: "text",
                  text: `LTA API error: ${error.response?.data?.Message ?? error.message}`
                }],
                isError: true
              };
            }
            throw error;
          }
        }

        case "traffic_incidents": {
          try {
            const response = await axios.get('https://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents', {
              headers: {
                'AccountKey': process.env.LTA_API_KEY!,
                'accept': 'application/json'
              }
            });
            
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          } catch (error) {
            if (axios.isAxiosError(error)) {
              return {
                content: [{
                  type: "text",
                  text: `LTA API error: ${error.response?.data?.Message ?? error.message}`
                }],
                isError: true
              };
            }
            throw error;
          }
        }

        case "station_crowd_forecast": {
          const { trainLine } = request.params.arguments as {
            trainLine: string;
          };

          try {
            const response = await axios.get('https://datamall2.mytransport.sg/ltaodataservice/PCDForecast', {
              params: {
                TrainLine: trainLine
              },
              headers: {
                'AccountKey': process.env.LTA_API_KEY!,
                'accept': 'application/json'
              }
            });
            
            return {
              content: [{
                type: "text",
                text: JSON.stringify(response.data, null, 2)
              }]
            };
          } catch (error) {
            if (axios.isAxiosError(error)) {
              return {
                content: [{
                  type: "text",
                  text: `LTA API error: ${error.response?.data?.Message ?? error.message}`
                }],
                isError: true
              };
            }
            throw error;
          }
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("LTA DataMall MCP server running on stdio");
  }
}

// Start the server
const server = new LTAServer();
server.run().catch(console.error);