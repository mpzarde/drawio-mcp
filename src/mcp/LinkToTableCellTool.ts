import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { GraphFileManager } from "../GraphFileManager.js";
import { Tool } from "./McpServer.js";

export class LinkToTableCellTool implements Tool {
  constructor(private fileManager = GraphFileManager.default) {}

  schema() {
    return {
      name: 'link_to_table_cell',
      description: 'Create connections from nodes to specific table cells',
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
          edges: {
            type: 'array',
            description: 'Array of edges connecting to table cells',
            items: {
              type: 'object',
              properties: {
                from: {
                  type: 'string',
                  description: 'Source node ID'
                },
                to_table: {
                  type: 'string',
                  description: 'Target table ID'
                },
                to_cell: {
                  type: 'object',
                  properties: {
                    row: {
                      type: 'number',
                      description: 'Row index (0-based)'
                    },
                    column: {
                      type: ['string', 'number'],
                      description: 'Column header name or index'
                    }
                  },
                  required: ['row', 'column']
                },
                title: {
                  type: 'string',
                  description: 'Connection label'
                },
                dashed: {
                  type: 'boolean',
                  description: 'Use dashed line style'
                },
                reverse: {
                  type: 'boolean',
                  description: 'Reverse arrow direction'
                },
                undirected: {
                  type: 'boolean',
                  description: 'Create undirected edge (no arrows)'
                }
              },
              required: ['from', 'to_table', 'to_cell']
            }
          }
        },
        required: ['file_path', 'edges']
      }
    };
  }

  async execute({ file_path, tab, edges }) {
    if (!file_path || !edges || !edges.length) {
      throw new McpError(ErrorCode.InvalidParams, 'file_path and edges are required');
    }

    const graph = await this.fileManager.loadGraph(file_path, tab);

    try {
      for (const edge of edges) {
        if (!edge.from || !edge.to_table || !edge.to_cell) {
          throw new McpError(ErrorCode.InvalidParams, 'Each edge must have from, to_table, and to_cell fields');
        }

        if (edge.to_cell.row === undefined || edge.to_cell.column === undefined) {
          throw new McpError(ErrorCode.InvalidParams, 'to_cell must have row and column fields');
        }

        const style: any = {};
        if (edge.dashed) style.dashed = 1;
        if (edge.reverse) style.reverse = 1;

        graph.linkToTableCell({
          from: edge.from,
          tableId: edge.to_table,
          row: edge.to_cell.row,
          column: edge.to_cell.column,
          title: edge.title,
          style,
          undirected: edge.undirected
        });
      }

      await this.fileManager.saveGraph(graph, file_path, typeof tab === 'string' ? tab : undefined);

      return {
        content: [
          {
            type: 'text',
            text: `Created ${edges.length} edge(s) to table cells in ${file_path}`
          }
        ]
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Failed to link to table cells: ${error.message}`);
    }
  }
}
