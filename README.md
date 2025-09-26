# DefectDojo Reports Automation

Tool to automate exporting 'Open Finding' reports from DefectDojo for multiple products and their latest engagements.

## Features

- Automated login to DefectDojo
- Batch processing of multiple products
- Automatic selection of latest engagement per product
- Excel export of open findings
- Configurable filename templates
- Summary reports in JSON format

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

Create a `.env` file with the following variables:

```env
# DefectDojo Configuration (Required)
DEFECTDOJO_URL=https://your-defectdojo-instance.com
DEFECTDOJO_USERNAME=your-username
DEFECTDOJO_PASSWORD=your-password
PRODUCTS=product1/module1,product2/module2

# Optional Configuration
HEADLESS_MODE=true
OUTPUT_DIR=./reports
FILENAME_TEMPLATE={moduleName}_findings_{version}.xlsx
```

### Configuration Options

| Variable               | Required | Default                              | Description                          |
|------------------------|:--------:|--------------------------------------|--------------------------------------|
| `DEFECTDOJO_URL`       |    ✅    | -                                    | URL of your DefectDojo instance      |
| `DEFECTDOJO_USERNAME`  |    ✅    | -                                    | Your DefectDojo username             |
| `DEFECTDOJO_PASSWORD`  |    ✅    | -                                    | Your DefectDojo password             |
| `PRODUCTS`             |    ✅    | -                                    | Comma-separated list of products     |
| `HEADLESS_MODE`        |    ❌    | `false`                              | Run browser in headless mode        |
| `OUTPUT_DIR`           |    ❌    | `./reports`                          | Directory for exported files        |
| `FILENAME_TEMPLATE`    |    ❌    | `{moduleName}_findings_{version}.xlsx` | Template for output filenames       |

### Filename Template

The filename template supports:
- `{moduleName}` - The module name
- `{version}` - The engagement version

Example: `{moduleName}_findings_{version}.xlsx` → `module1_findings_v1.2.xlsx`

## Usage

Run the automation:
```bash
node run_automation.js
```

## Output

The tool creates:
1. **Excel files**: One per product with findings data
2. **Summary JSON**: Results summary with timestamps

Example output:
```
reports/
├── module1_findings_v1.2.xlsx
├── module2_findings_v2.1.xlsx
└── summary_2024-01-15T10-30-45.json
```