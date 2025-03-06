import Papa from "papaparse";
import fs from "fs";

function checkCsvDuplicates(filePath: string) {
  const csvContent = fs.readFileSync(filePath, "utf-8");
  const parseResult = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = parseResult.data;
  console.log(`Total rows: ${rows.length}`);

  // Convert each row to a string, considering all fields
  const rowStrings = rows.map((row) => JSON.stringify(row));
  const uniqueRows = [...new Set(rowStrings)];

  console.log(`Unique rows: ${uniqueRows.length}`);

  if (uniqueRows.length < rows.length) {
    console.log(`Found ${rows.length - uniqueRows.length} duplicates`);

    const counts = rowStrings.reduce(
      (acc, curr) => {
        acc[curr] = (acc[curr] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    Object.entries(counts)
      .filter(([_, count]) => count > 1)
      .forEach(([row, count]) => {
        console.log(`\nDuplicate entry found ${count} times:`);
        console.log(JSON.parse(row));
      });
  } else {
    console.log("No duplicates found");
  }
}

// Usage:
checkCsvDuplicates("/home/k4r7ik/Project/VulnTrackerBackend/tessolve.csv");
