import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table"
  
  const invoices = [
    {
      invoice: "INV001",
      paymentStatus: "Paid",
      totalAmount: "$250.00",
      paymentMethod: "Credit Card",
    },
    {
      invoice: "INV002",
      paymentStatus: "Pending",
      totalAmount: "$150.00",
      paymentMethod: "PayPal",
    },
    {
      invoice: "INV003",
      paymentStatus: "Unpaid",
      totalAmount: "$350.00",
      paymentMethod: "Bank Transfer",
    },
    {
      invoice: "INV004",
      paymentStatus: "Paid",
      totalAmount: "$450.00",
      paymentMethod: "Credit Card",
    },
    {
      invoice: "INV005",
      paymentStatus: "Paid",
      totalAmount: "$550.00",
      paymentMethod: "PayPal",
    },
    {
      invoice: "INV006",
      paymentStatus: "Pending",
      totalAmount: "$200.00",
      paymentMethod: "Bank Transfer",
    },
    {
      invoice: "INV007",
      paymentStatus: "Unpaid",
      totalAmount: "$300.00",
      paymentMethod: "Credit Card",
    },
  ]
  
  export interface Column {
    key: string;
    header: string;
    className?: string;
    formatter?: (value: any) => React.ReactNode;
    isNumeric?: boolean;
  }
  
  export interface TableComponentProps {
    data: Array<Record<string, any>>;
    columns: Column[];
    caption?: string;
    footerData?: {
      label: string;
      value: string | number;
      colSpan?: number;
    };
    className?: string;
  }
  
  export function TableComponent({
    data,
    columns,
    caption,
    footerData,
    className,
  }: TableComponentProps) {
    return (
      <Table className={className}>
        {caption && <TableCaption>{caption}</TableCaption>}
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead 
                key={column.key} 
                className={column.isNumeric ? "text-right" : column.className}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((column) => (
                <TableCell 
                  key={`${rowIndex}-${column.key}`} 
                  className={column.isNumeric ? "text-right" : column.className}
                >
                  {column.formatter 
                    ? column.formatter(row[column.key]) 
                    : row[column.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        {footerData && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={footerData.colSpan || columns.length - 1}>
                {footerData.label}
              </TableCell>
              <TableCell className="text-right">{footerData.value}</TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    )
  }
  
  // For backward compatibility and demo purposes
  export function TableDemo() {
    const columns: Column[] = [
      { key: "invoice", header: "Invoice", className: "w-[100px]" },
      { key: "paymentStatus", header: "Status" },
      { key: "paymentMethod", header: "Method" },
      { key: "totalAmount", header: "Amount", isNumeric: true },
    ];
  
    const footerData = {
      label: "Total",
      value: "$2,500.00",
    };
  
    return (
      <TableComponent
        data={invoices}
        columns={columns}
        caption="A list of your recent invoices."
        footerData={footerData}
      />
    )
  }
  
  export default TableComponent;
  