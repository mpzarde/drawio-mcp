import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { GraphFileManager } from "../GraphFileManager.js";
import { Tool } from "./McpServer.js";

export class EditTableTool implements Tool {
  constructor(private fileManager = GraphFileManager.default) {}

  schema() {
    return {
      name: 'edit_table',
      description: 'Perform multiple operations on a table (add/remove/rename columns, add/remove rows, update cells)',
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
            description: 'ID of the table to modify'
          },
          operations: {
            type: 'array',
            description: 'Array of operations to perform',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['add_column', 'rename_column', 'remove_column', 'add_row', 'remove_row', 'update_cell'],
                  description: 'Type of operation'
                },
                // add_column fields
                header: { type: 'string', description: 'Column header (for add_column, rename_column)' },
                position: { type: 'number', description: 'Position index (for add_column, add_row)' },
                defaultValue: { type: 'string', description: 'Default value for new column cells (for add_column)' },
                // rename_column fields
                oldHeader: { type: 'string', description: 'Old column header (for rename_column)' },
                newHeader: { type: 'string', description: 'New column header (for rename_column)' },
                // remove_column/row fields
                column: { type: ['string', 'number'], description: 'Column name or index (for remove_column, update_cell)' },
                row: { type: 'number', description: 'Row index (for remove_row, update_cell)' },
                // add_row fields
                values: { type: 'array', items: { type: 'string' }, description: 'Row values (for add_row)' },
                // update_cell fields
                value: { type: 'string', description: 'New cell value (for update_cell)' }
              },
              required: ['type']
            }
          }
        },
        required: ['file_path', 'table_id', 'operations']
      }
    };
  }

  async execute({ file_path, tab, table_id, operations }) {
    if (!file_path || !table_id || !operations || !operations.length) {
      throw new McpError(ErrorCode.InvalidParams, 'file_path, table_id, and operations are required');
    }

    const graph = await this.fileManager.loadGraph(file_path, tab);

    try {
      for (const op of operations) {
        switch (op.type) {
          case 'add_column':
            if (!op.header) {
              throw new McpError(ErrorCode.InvalidParams, 'add_column requires header field');
            }
            graph.addTableColumn({
              tableId: table_id,
              header: op.header,
              position: op.position !== undefined ? op.position : -1,
              defaultValue: op.defaultValue || ''
            });
            break;

          case 'rename_column':
            if (!op.oldHeader || !op.newHeader) {
              throw new McpError(ErrorCode.InvalidParams, 'rename_column requires oldHeader and newHeader fields');
            }
            graph.renameTableColumn({
              tableId: table_id,
              oldHeader: op.oldHeader,
              newHeader: op.newHeader
            });
            break;

          case 'remove_column':
            if (op.column === undefined) {
              throw new McpError(ErrorCode.InvalidParams, 'remove_column requires column field');
            }
            graph.removeTableColumn({
              tableId: table_id,
              column: op.column
            });
            break;

          case 'add_row':
            if (!op.values) {
              throw new McpError(ErrorCode.InvalidParams, 'add_row requires values field');
            }
            graph.addTableRow({
              tableId: table_id,
              values: op.values,
              position: op.position !== undefined ? op.position : -1
            });
            break;

          case 'remove_row':
            if (op.row === undefined) {
              throw new McpError(ErrorCode.InvalidParams, 'remove_row requires row field');
            }
            graph.removeTableRow({
              tableId: table_id,
              row: op.row
            });
            break;

          case 'update_cell':
            if (op.row === undefined || op.column === undefined || op.value === undefined) {
              throw new McpError(ErrorCode.InvalidParams, 'update_cell requires row, column, and value fields');
            }
            graph.updateTableCell({
              tableId: table_id,
              row: op.row,
              column: op.column,
              value: op.value
            });
            break;

          default:
            throw new McpError(ErrorCode.InvalidParams, `Unknown operation type: ${op.type}`);
        }
      }

      await this.fileManager.saveGraph(graph, file_path, typeof tab === 'string' ? tab : undefined);

      const tableInfo = graph.getTableInfo(table_id);

      return {
        content: [
          {
            type: 'text',
            text: `Table '${table_id}' updated with ${operations.length} operation(s). Table now has ${tableInfo.columns.length} columns and ${tableInfo.rows.length} rows`
          }
        ]
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Failed to edit table: ${error.message}`);
    }
  }
}
