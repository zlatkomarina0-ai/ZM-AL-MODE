# PLUTON → Google Sheets / AppSheet import

This workflow is a **manual CSV bridge**. It does not create a live GitHub-to-AppSheet connection.

## Export from PLUTON

1. Open the [ZLATKO AI MODE app](https://zlatkomarina0-ai.github.io/ZM-AL-MODE/).
2. Open the **PLUTON** tab.
3. Import the bulletin, run the local queue, then choose **Извези CSV за AppSheet**.
4. Keep the `ID` column unchanged. Each task uses its UUID as a stable row key.

The CSV includes match identifiers and team names, chief assignment, task status, attempts, validation results, source fields, and timestamps. Nested values such as odds are serialized as JSON text.

## Prepare the Google Sheet

1. Import the CSV into a sheet, or paste its header and data into the existing AppSheet source sheet.
2. Ensure `ID` exists as a **Text** column and every row has a unique, non-empty value.
3. Do not use the spreadsheet row number as the key. Do not regenerate IDs when editing existing rows.
4. If the existing table has a different schema, add the needed columns or map the CSV fields to the matching columns before importing.

## Set the AppSheet key

1. Open the AppSheet editor for the existing app.
2. Go to **Data → Columns** and select the table that showed the row-number key warning (previously `Табела1 2`).
3. Regenerate the table structure if the new `ID` column is not listed.
4. Set `ID` to type **Text** and mark it as the table's **Key**.
5. Unmark the spreadsheet row number as the key, then save and verify that each row has a unique ID.

## Important limits

- CSV export/import is not automatic sync. Re-exporting and importing a file does not itself update existing AppSheet rows by key; use a controlled update/import workflow and avoid blindly appending the same rows.
- PLUTON deduplicates match tasks when importing a bulletin into the same browser's local queue. That does not deduplicate rows independently inside Google Sheets or AppSheet.
- Local task history is stored in the current browser/device. It is not shared across devices.
- No external AI provider API is called by the CSV export or import.
