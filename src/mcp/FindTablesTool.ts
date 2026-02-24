import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { GraphFileManager } from "../GraphFileManager.js";
import { Tool } from "./McpServer.js";

export class FindTablesTool implements Tool {
  constructor(private fileManager = GraphFileManager.default) {}

  schema() {
    return {
      name: 'find_tables',
      description: 'Search for tables in a diagram using filter criteria',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Absolute or relative path to the diagram file'
          },
          tab: {
            type: ['string', 'number'],
            description: 'Optional tab name or index (searches all tabs if omitted)'
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
                description: 'Partial ID match'
              },
              title: {
                type: 'string',
                description: 'Exact table title/label match'
              },
              title_contains: {
                type: 'string',
                description: 'Partial table title/label match (case-insensitive)'
              },
              has_column: {
                type: 'string',
                description: 'Table must have this column header'
              },
              row_count_min: {
                type: 'number',
                description: 'Minimum number of rows'
              },
              row_count_max: {
                type: 'number',
                description: 'Maximum number of rows'
              },
              data: {
                type: 'object',
                description: 'Custom data properties to match (key-value pairs) on the table container'
              }
            }
          }
        },
        required: ['file_path']
      }
    };
  }

  async execute({ file_path, tab, filters = {} }) {
    if (!file_path) {
      throw new McpError(ErrorCode.InvalidParams, 'file_path is required');
    }

    const graph = await this.fileManager.loadGraph(file_path, tab);

    try {
      const results = graph.findTables({ filters });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ results }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Failed to find tables: ${error.message}`);
    }
  }
}
