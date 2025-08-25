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
import { z } from "zod";

// Load environment variables
dotenv.config();

// Configuration schema
export const configSchema = z.object({
  ltaApiKey: z.string().describe("LTA DataMall API key"),
});

export type Config = z.infer<typeof configSchema>;

export function createServer(config: Config) {
  const server = new Server({
    name: "lta-datamall-server",
    version: "0.1.0"
  }, {
    capabilities: {
      tools: {}
    }
  });

  // Error handling
  server.onerror = (error: Error) => {
    console.error("[MCP Error]", error);
  };

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
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
          properties: {}
        }
      },
      {
        name: "carpark_availability",
        description: "Get real-time availability of parking lots for HDB, LTA, and URA carparks. Updates every minute.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "travel_times",
        description: "Get estimated travel times on expressway segments. Updates every 5 minutes.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "traffic_incidents",
        description: "Get current road incidents including accidents, roadworks, and heavy traffic. Updates every 2 minutes.",
        inputSchema: {
          type: "object",
          properties: {}
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
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
              'AccountKey': config.ltaApiKey,
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
              'AccountKey': config.ltaApiKey,
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
              'AccountKey': config.ltaApiKey,
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
              'AccountKey': config.ltaApiKey,
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
              'AccountKey': config.ltaApiKey,
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
              'AccountKey': config.ltaApiKey,
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
              'AccountKey': config.ltaApiKey,
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

  return server;
}

// Export default function for Smithery HTTP deployment
export default function createServerForSmithery({ config }: { config: Config }) {
  return createServer(config);
}

// For backward compatibility with STDIO (when run directly)
if (import.meta.url === `file://${process.argv[1]}`) {
  const ltaApiKey = process.env.LTA_API_KEY;
  if (!ltaApiKey) {
    console.error("LTA_API_KEY environment variable is required");
    process.exit(1);
  }
  
  const server = createServer({ ltaApiKey });
  const transport = new StdioServerTransport();
  
  server.connect(transport).then(() => {
    console.error("LTA DataMall MCP server running on stdio");
  }).catch(console.error);
  
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
}