# Shipment CSV and XLSX schema

Shipment imports accept UTF-8 CSV files and XLSX workbooks. The first row must
contain these required columns:

```text
shipment_id,origin,destination,weight_value,weight_unit,distance_value,distance_unit,transport_method
```

| Column | Accepted values |
| --- | --- |
| `shipment_id` | Required text identifier, up to 80 characters. |
| `origin` | Required location text, up to 200 characters. |
| `destination` | Required location text, up to 200 characters. |
| `weight_value` | Finite positive number. |
| `weight_unit` | `g`, `kg`, `lb`, or `mt`. |
| `distance_value` | Finite positive number. |
| `distance_unit` | `m`, `km`, or `mi`. |
| `transport_method` | `plane`/`air`, `truck`/`road`, `train`/`rail`, or `ship`/`ocean`. |

The following columns are optional and remain absent rather than being
invented when an older file does not provide them:

| Column | Accepted values |
| --- | --- |
| `shipment_date` | ISO `YYYY-MM-DD`; common aliases such as `departure_date` are accepted. |
| `supplier_name` | Supplier or carrier text, up to 200 characters; `supplier`, `vendor`, and `carrier` aliases are accepted. |

Uploads are limited to 10 MB and 500 data rows. Valid rows are normalized to
kilograms, kilometres, and canonical freight modes. Invalid rows are returned
with their source row and field; valid rows remain available for analysis.

The API stores normalized rows under the active workspace and returns:

- total weight and emissions in kg CO₂e and tonnes CO₂e;
- monthly or yearly emissions and emissions by freight mode;
- supplier contribution within each mode when the source identifies suppliers;
- the ten highest-emission shipment hotspots;
- factor source, version, applicability, assumptions, and data-quality warnings.

Download the starter file: [`shipments.csv`](examples/shipments.csv).
