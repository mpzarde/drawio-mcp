import { GraphFileManager } from "../GraphFileManager.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Tool } from "./McpServer.js";

export class FindNodesTool implements Tool {
  constructor(private fileManager = GraphFileManager.default) {}

  schema() {
    return {
      name: 'find_nodes',
      description: 'Search for nodes in a diagram file using various filter criteria',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Absolute or relative path to the diagram file'
          },
          tab: {
            type: ['string', 'number'],
            description: 'Optional tab name or index to search in (searches all tabs if omitted)'
          },
          filters: {
            type: 'object',
            description: 'Search criteria',
            properties: {
              id: {
                type: 'string',
                description: 'Exact ID match'
              },
              id_contains: {
                type: 'string',
                description: 'Partial ID match (case-sensitive)'
              },
              title: {
                type: 'string',
                description: 'Exact title match'
              },
              title_contains: {
                type: 'string',
                description: 'Partial title match (case-insensitive)'
              },
              kind: {
                type: 'string',
                description: 'Node kind/shape (Rectangle, Ellipse, Cylinder, Cloud, etc.)'
              },
              x_min: { type: 'number', description: 'Minimum X coordinate' },
              x_max: { type: 'number', description: 'Maximum X coordinate' },
              y_min: { type: 'number', description: 'Minimum Y coordinate' },
              y_max: { type: 'number', description: 'Maximum Y coordinate' },
              data: {
                type: 'object',
                description: 'Custom data properties to match (key-value pairs)'
              }
            }
          }
        },
        required: ['file_path']
      }
    }
  }

  async execute({ file_path, tab, filters = {} }) {
    if (!file_path) {
      throw new McpError(ErrorCode.InvalidParams, 'file_path is required');
    }

    try {
      // If tab is specified, search only that tab
      if (tab !== undefined) {
        const graph = await this.fileManager.loadGraph(file_path, tab);
        const results = graph.findNodes(filters);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                tab: typeof tab === 'number' ? `Tab ${tab}` : tab,
                results
              }, null, 2)
            }
          ]
        };
      }

      // Otherwise, search all tabs
      const tabs = await this.fileManager.listTabs(file_path);
      const allResults: any[] = [];

      for (const tabInfo of tabs) {
        const graph = await this.fileManager.loadGraph(file_path, tabInfo.name);
        const tabResults = graph.findNodes(filters);

        for (const node of tabResults) {
          allResults.push({
            ...node,
            tab: tabInfo.name
          });
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              results: allResults
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Failed to search nodes: ${error.message}`);
    }
  }
}
