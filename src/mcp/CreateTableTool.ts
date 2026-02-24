import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { GraphFileManager } from "../GraphFileManager.js";
import { Tool } from "./McpServer.js";

export class CreateTableTool implements Tool {
  constructor(private fileManager = GraphFileManager.default) {}

  schema() {
    return {
      name: 'create_table',
      description: 'Create a new table with headers and optional data rows in a diagram file',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Absolute or relative path to the diagram file'
          },
          tab: {
            type: ['string', 'number'],
            description: 'Optional tab name or index (defaults to first tab)'
          },
          table: {
            type: 'object',
            description: 'Table configuration',
            properties: {
              id: {
                type: 'string',
                description: 'Unique identifier for the table'
              },
              x: {
                type: 'number',
                description: 'X coordinate for table position'
              },
              y: {
                type: 'number',
                description: 'Y coordinate for table position'
              },
              headers: {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
                description: 'Column headers (minimum 1)'
              },
              rows: {
                type: 'array',
                items: {
                  type: 'array',
                  items: { type: 'string' }
                },
                description: 'Data rows (each row is an array of strings)'
              },
              cellWidth: {
                type: 'number',
                default: 120,
                description: 'Width of each cell (default: 120)'
              },
              cellHeight: {
                type: 'number',
                default: 30,
                description: 'Height of each cell (default: 30)'
              },
              data: {
                type: 'object',
                description: 'Additional metadata for the table'
              }
            },
            required: ['id', 'x', 'y', 'headers']
          }
        },
        required: ['file_path', 'table']
      }
    };
  }

  async execute({ file_path, tab, table }) {
    if (!file_path || !table) {
      throw new McpError(ErrorCode.InvalidParams, 'file_path and table are required');
    }

    const { id, x, y, headers, rows, cellWidth, cellHeight, data } = table;

    if (!id || !headers || headers.length === 0) {
      throw new McpError(ErrorCode.InvalidParams, 'table.id and table.headers are required');
    }

    if (x === undefined || y === undefined) {
      throw new McpError(ErrorCode.InvalidParams, 'table.x and table.y are required');
    }

    const graph = await this.fileManager.loadGraph(file_path, tab);

    try {
      const tableInfo = graph.addTable({
        id,
        x: Number(x),
        y: Number(y),
        headers,
        rows: rows || [],
        cellWidth: cellWidth ? Number(cellWidth) : 120,
        cellHeight: cellHeight ? Number(cellHeight) : 30,
        data: data || {}
      });

      await this.fileManager.saveGraph(graph, file_path, typeof tab === 'string' ? tab : undefined);

      return {
        content: [
          {
            type: 'text',
            text: `Table '${id}' created in ${file_path} with ${headers.length} columns and ${rows ? rows.length : 0} rows`
          }
        ]
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Failed to create table: ${error.message}`);
    }
  }
}
