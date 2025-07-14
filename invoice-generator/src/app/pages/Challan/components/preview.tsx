"use client";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
  Image,
} from "@react-pdf/renderer";

// Define styles
const styles = StyleSheet.create({
  page: {
    padding: 32,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  companyInfo: {
    fontSize: 10,
    lineHeight: 1.5,
    fontWeight: "bold",
  },
  title: {
    fontSize: 24,
    fontWeight: 1000,
    marginVertical: 12,
    textAlign: "center",
    textDecoration: "underline",
  },
  titleL: {
    fontSize: 28,
    fontWeight: 'heavy',
    marginTop: 8,
    marginBottom: 12,
    textAlign: "center",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#000",
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  tableRow: {
    flexDirection: "row",
    borderColor: "#000",
  },
  cell: {
    padding: 8,
    fontSize: 12,
    borderRightWidth: 1,
    borderColor: "#000",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    fontSize: 12,
    fontWeight: "bold",
    borderBottomWidth: 1,
  },
  note: {
    fontSize: 10,
    fontWeight: "bold",
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    textAlign: "center",
  },
  logo: {
    width: 420,
    height: "auto",
    margin: "0 auto",
    marginBottom: 40,
  },
});

// PDF Document Component
interface InvoicePDFProps {
  date: string;
  PO: string;
  challan: string;
  GP: string;
  bill: string;
  Company_Name: string;
}

const InvoicePDF: React.FC<InvoicePDFProps> = ({
  date,
  PO,
  challan,
  GP,
  bill,
  Company_Name,
}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Image src="/zumech.png" style={styles.logo} />

      <View style={styles.header}>
        <View>
          <Text style={styles.companyInfo}>Email: z.ushahid@gmail.com</Text>
          <Text style={styles.companyInfo}>Contact: 03092308078</Text>
          <Text style={styles.companyInfo}>Bill No: {bill}</Text>
          <Text style={styles.companyInfo}>Challan No: {challan}</Text>
          <Text style={styles.companyInfo}>Date: {date}</Text>
        </View>
        <View>
          <Text style={styles.companyInfo}>P.O. No: {PO}</Text>
          <Text style={styles.companyInfo}>G.P. No: {GP}</Text>
        </View>
      </View>

      <Text style={styles.title}>Company Name: {Company_Name}</Text>
      <Text style={styles.titleL}>Invoice</Text>

      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.cell, { flex: 1, borderLeftWidth: 1 }]}>Qty</Text>
        <Text style={[styles.cell, { flex: 8 }]}>Description</Text>
        <Text style={[styles.cell, { flex: 2 }]}>Rate</Text>
        <Text style={[styles.cell, { flex: 2, borderRightWidth: 1 }]}>
          Amount
        </Text>
      </View>

      {/* Table Rows */}
      {[...Array(15)].map((_, idx) => (
        <View
          key={idx}
          style={[
            styles.tableRow,
            idx === 14 ? { borderBottomWidth: 1, borderColor: "black" } : {},
          ]}
        >
          <Text style={[styles.cell, { flex: 1, borderLeftWidth: 1 }]}></Text>
          <Text style={[styles.cell, { flex: 8 }]}></Text>
          <Text style={[styles.cell, { flex: 2 }]}></Text>
          <Text style={[styles.cell, { flex: 2, borderRightWidth: 1 }]}></Text>
        </View>
      ))}

      <View style={styles.totalRow}>
        <Text>Total:</Text>
        <Text>Rs. 0.00</Text>
      </View>

      <Text style={styles.note}>
        Note: This is a computer-generated document and does not require a
        signature.
      </Text>
    </Page>
  </Document>
);

// Main React component with Download button
const Preview = () => {
  const date = new Date().toLocaleDateString();
  const PO = "00001";
  const challan = "00001";
  const GP = "00001";
  const bill = "00001";
  const Company_Name = "Kassim Textile Mills Limited";

  return (
    <div className="flex flex-col items-start gap-6">
      <PDFDownloadLink
        document={
          <InvoicePDF
            date={date}
            PO={PO}
            challan={challan}
            GP={GP}
            bill={bill}
            Company_Name={Company_Name}
          />
        }
        fileName={`Invoice-${bill}.pdf`}
      >
        {({ loading }) =>
          loading ? (
            <button className="bg-gray-400 py-2 px-4 rounded-xl">
              Generating PDF...
            </button>
          ) : (
            <button className="bg-[#ff6c31] py-2 px-4 rounded-xl">
              Download PDF
            </button>
          )
        }
      </PDFDownloadLink>
    </div>
  );
};

export default Preview;
