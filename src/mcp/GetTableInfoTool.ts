import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { GraphFileManager } from "../GraphFileManager.js";
import { Tool } from "./McpServer.js";

export class GetTableInfoTool implements Tool {
  constructor(private fileManager = GraphFileManager.default) {}

  schema() {
    return {
      name: 'get_table_info',
      description: 'Get detailed information about a specific table including structure and data',
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
          table_id: {
            type: 'string',
            description: 'ID of the table to retrieve'
          }
        },
        required: ['file_path', 'table_id']
      }
    };
  }

  async execute({ file_path, tab, table_id }) {
    if (!file_path || !table_id) {
      throw new McpError(ErrorCode.InvalidParams, 'file_path and table_id are required');
    }

    const graph = await this.fileManager.loadGraph(file_path, tab);

    try {
      const tableInfo = graph.getTableInfo(table_id);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(tableInfo, null, 2)
          }
        ]
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Failed to get table info: ${error.message}`);
    }
  }
}
