from fastapi import FastAPI, UploadFile, Form,File,HTTPException, Query
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io
import mysql.connector
from mysql.connector import Error
import math
from fastapi.responses import StreamingResponse

app = FastAPI()


# MySQL connection details
DB_CONFIG = {
    "host": "localhost",
    "user": "root",          # change to your MySQL user
    "password": "root@123root",  # change to your MySQL password
    "database": "employee_db"
}

# Columns to extract
REQUIRED_COLUMNS = [
    "Name", "Employee id", "Grade Name", "HCM Supervisor id", "HCM Supervisor name",
    "Project id", "Project name", "Service line",
    "GenAI Maturity", "tool", "DPS-Ranking", "DPS performance Ranking",
    "DPS-Activity Ranking", "DPS-Collaboration", "DPS-efficiency Ranking"
]

RANK_MAP = {
    "gold": 3,
    "silver": 2,
    "bronze": 1,
    "none": 0,
    "no score": 0,
    "noscore": 0,
    "-": 0
}

GENAI_MAP = {
    "none": 0,
    "na": 0,
    "unknown": 0,
    "low": 0,
    "inactive": 0,
    "basic": 1,
    "intermediate": 2,
    "advanced": 3
}

def score_value(val, mapper):
    if val is None or pd.isna(val):
        return 0
    try:
        key = str(val).strip().lower()
        return mapper.get(key, 0)
    except Exception:
        return 0


def service_line_averages(month: str = None):
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)

        if not month:
            month = datetime.utcnow().strftime("%Y-%m")

        # Ensure table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS overall_avg (
                service_line VARCHAR(255),
                overall_avg INT,
                genai_avg INT,
                dps_ranking_avg INT,
                performance_avg INT,
                activity_avg INT,
                collaboration_avg INT,
                efficiency_avg INT,
                month VARCHAR(50),
                )
        """)


        # Fetch employees for given month
        cursor.execute("""
            SELECT Employee_id, Service_line,
                   DPS_Ranking_score, GenAI_Maturity_score,
                   DPS_performance_Ranking_score, DPS_Activity_Ranking_score,
                   DPS_Collaboration_score, DPS_efficiency_Ranking_score,
                   Month
            FROM employee_data
            WHERE Month = %s
        """, (month,))
        rows = cursor.fetchall()

        # Step 1: group scores by service line
        service_line_scores = {}
        for row in rows:
            sl = row["Service_line"]
            if sl not in service_line_scores:
                service_line_scores[sl] = {
                    "genai": [],
                    "dps_ranking": [],
                    "performance": [],
                    "activity": [],
                    "collaboration": [],
                    "efficiency": []
                }
            # Append scores if not None
            if row["GenAI_Maturity_score"] is not None:
                service_line_scores[sl]["genai"].append(row["GenAI_Maturity_score"])
            if row["DPS_Ranking_score"] is not None:
                service_line_scores[sl]["dps_ranking"].append(row["DPS_Ranking_score"])
            if row["DPS_performance_Ranking_score"] is not None:
                service_line_scores[sl]["performance"].append(row["DPS_performance_Ranking_score"])
            if row["DPS_Activity_Ranking_score"] is not None:
                service_line_scores[sl]["activity"].append(row["DPS_Activity_Ranking_score"])
            if row["DPS_Collaboration_score"] is not None:
                service_line_scores[sl]["collaboration"].append(row["DPS_Collaboration_score"])
            if row["DPS_efficiency_Ranking_score"] is not None:
                service_line_scores[sl]["efficiency"].append(row["DPS_efficiency_Ranking_score"])

        # Step 2: compute averages per column, then overall
        result = {}
        for sl, scores in service_line_scores.items():
            genai_avg = round(sum(scores["genai"]) / len(scores["genai"])) if scores["genai"] else 0
            dps_ranking_avg = round(sum(scores["dps_ranking"]) / len(scores["dps_ranking"])) if scores["dps_ranking"] else 0
            performance_avg = round(sum(scores["performance"]) / len(scores["performance"])) if scores["performance"] else 0
            activity_avg = round(sum(scores["activity"]) / len(scores["activity"])) if scores["activity"] else 0
            collaboration_avg = round(sum(scores["collaboration"]) / len(scores["collaboration"])) if scores["collaboration"] else 0
            efficiency_avg = round(sum(scores["efficiency"]) / len(scores["efficiency"])) if scores["efficiency"] else 0

            # Overall avg = average of column averages
            overall_avg = round(
                (genai_avg + dps_ranking_avg + performance_avg +
                 activity_avg + collaboration_avg + efficiency_avg) / 6
            )

            result[sl] = {
                "overall_avg": overall_avg,
                "genai_avg": genai_avg,
                "dps_ranking_avg": dps_ranking_avg,
                "performance_avg": performance_avg,
                "activity_avg": activity_avg,
                "collaboration_avg": collaboration_avg,
                "efficiency_avg": efficiency_avg
            }

            # Insert into DB
            cursor.execute("""
                INSERT INTO overall_avg (
                    service_line, overall_avg, genai_avg, dps_ranking_avg,
                    performance_avg, activity_avg, collaboration_avg,
                    efficiency_avg, month
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                sl, overall_avg, genai_avg, dps_ranking_avg,
                performance_avg, activity_avg, collaboration_avg,
                efficiency_avg, month
            ))

        conn.commit()
        cursor.close()
        conn.close()

        return {"month": month, "averages": result}

    except Error as e:
        return {"status": "error", "message": str(e)}


@app.post("/upload")
async def upload_excel(month: str = Form(None), file: UploadFile = File(...)):
    try:
        # Read Excel file into pandas DataFrame
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))

        # Keep only required columns
        df = df[REQUIRED_COLUMNS]

        # Add month column
        print(month)
        df["Month"] = month

        # Clean DataFrame
        df = df.dropna(how="all")              # drop fully empty rows
        df = df.dropna(subset=["Employee id"]) # drop rows missing Employee id
        if df.iloc[-1].isnull().all():         # drop last row if empty
            df = df.iloc[:-1]

        # Connect to MySQL
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Create table with raw + score columns
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS employee_data (
                id INT AUTO_INCREMENT PRIMARY KEY,
                Name VARCHAR(255),
                Employee_id VARCHAR(255),
                Grade_Name VARCHAR(255),
                HCM_Supervisor_id VARCHAR(255),
                HCM_Supervisor_name VARCHAR(255),
                Project_id VARCHAR(255),
                Project_name VARCHAR(255),
                Service_line VARCHAR(255),
                GenAI_Maturity_raw VARCHAR(255),
                GenAI_Maturity_score INT,
                tool VARCHAR(255),
                DPS_Ranking_raw VARCHAR(255),
                DPS_Ranking_score INT,
                DPS_performance_Ranking_raw VARCHAR(255),
                DPS_performance_Ranking_score INT,
                DPS_Activity_Ranking_raw VARCHAR(255),
                DPS_Activity_Ranking_score INT,
                DPS_Collaboration_raw VARCHAR(255),
                DPS_Collaboration_score INT,
                DPS_efficiency_Ranking_raw VARCHAR(255),
                DPS_efficiency_Ranking_score INT,
                Month VARCHAR(50)
            )
        """)
        # Insert rows
        for _, row in df.iterrows():
            values = [
                None if pd.isna(row["Name"]) else row["Name"],
                str(int(row["Employee id"])) if isinstance(row["Employee id"], float) and row["Employee id"].is_integer() else str(row["Employee id"]),
                None if pd.isna(row["Grade Name"]) else row["Grade Name"],
                None if pd.isna(row["HCM Supervisor id"]) else str(row["HCM Supervisor id"]),
                None if pd.isna(row["HCM Supervisor name"]) else row["HCM Supervisor name"],
                None if pd.isna(row["Project id"]) else str(row["Project id"]),
                None if pd.isna(row["Project name"]) else row["Project name"],
                None if pd.isna(row["Service line"]) else row["Service line"],

                # GenAI Maturity raw + score
                None if pd.isna(row["GenAI Maturity"]) else row["GenAI Maturity"],
                score_value(row["GenAI Maturity"], GENAI_MAP),

                None if pd.isna(row["tool"]) else row["tool"],

                # DPS rankings raw + score
                None if pd.isna(row["DPS-Ranking"]) else row["DPS-Ranking"],
                score_value(row["DPS-Ranking"], RANK_MAP),

                None if pd.isna(row["DPS performance Ranking"]) else row["DPS performance Ranking"],
                score_value(row["DPS performance Ranking"], RANK_MAP),

                None if pd.isna(row["DPS-Activity Ranking"]) else row["DPS-Activity Ranking"],
                score_value(row["DPS-Activity Ranking"], RANK_MAP),

                None if pd.isna(row["DPS-Collaboration"]) else row["DPS-Collaboration"],
                score_value(row["DPS-Collaboration"], RANK_MAP),

                None if pd.isna(row["DPS-efficiency Ranking"]) else row["DPS-efficiency Ranking"],
                score_value(row["DPS-efficiency Ranking"], RANK_MAP),

                month
            ]

            cursor.execute("""
                INSERT INTO employee_data (
                    Name, Employee_id, Grade_Name, HCM_Supervisor_id, HCM_Supervisor_name,
                    Project_id, Project_name, Service_line,
                    GenAI_Maturity_raw, GenAI_Maturity_score,
                    tool,
                    DPS_Ranking_raw, DPS_Ranking_score,
                    DPS_performance_Ranking_raw, DPS_performance_Ranking_score,
                    DPS_Activity_Ranking_raw, DPS_Activity_Ranking_score,
                    DPS_Collaboration_raw, DPS_Collaboration_score,
                    DPS_efficiency_Ranking_raw, DPS_efficiency_Ranking_score,
                    Month
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,
                          %s,%s,%s,
                          %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, values)
        conn.commit()
        cursor.close()
        conn.close()
        service_line_averages(month)

        return {"status": "success", "rows_inserted": len(df)}

    except Error as e:
        return {"status": "error", "message": str(e)}
    except Exception as e:
        return {"status": "error", "message": str(e)}




@app.get("/service-line-comparison")
def service_line_comparison(months: int = Query(1, ge=1, le=3)):
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)

        # Current month
        current_month = datetime.utcnow().strftime("%Y-%m")

        # Build list of months: past first, then current
        month_list = []
        for i in range(months, 0, -1):
            past = (datetime.utcnow().replace(day=1) - pd.DateOffset(months=i)).strftime("%Y-%m")
            month_list.append(past)
        month_list.append(current_month)

        # Fetch data for these months
        format_strings = ",".join(["%s"] * len(month_list))
        cursor.execute(f"""
            SELECT service_line, overall_avg, month
            FROM overall_avg
            WHERE month IN ({format_strings})
        """, tuple(month_list))
        rows = cursor.fetchall()

        # Organize by service line
        comparison = {}
        for row in rows:
            sl = row["service_line"]
            if sl not in comparison:
                comparison[sl] = {}
            comparison[sl][row["month"]] = row["overall_avg"]

        cursor.close()
        conn.close()

        return {"months": month_list, "data": comparison}

    except Error as e:
        return {"status": "error", "message": str(e)}



@app.get("/service-lines")
def get_service_lines():
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT Service_line FROM employee_data WHERE Service_line IS NOT NULL")
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return [r[0] for r in rows]
    except Error as e:
        return {"status": "error", "message": str(e)}


@app.get("/service-line-deviation")
def service_line_deviation(service_line: str, months: int = Query(1, ge=1, le=3)):
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)

        # Current + past months
        current_month = datetime.utcnow().strftime("%Y-%m")
        month_list = []
        for i in range(months, 0, -1):
            past = (datetime.utcnow().replace(day=1) - pd.DateOffset(months=i)).strftime("%Y-%m")
            month_list.append(past)
        month_list.append(current_month)

        format_strings = ",".join(["%s"] * len(month_list))
        cursor.execute(f"""
            SELECT month, overall_avg, genai_avg, dps_ranking_avg,
                   performance_avg, activity_avg, collaboration_avg,
                   efficiency_avg
            FROM overall_avg
            WHERE service_line = %s AND month IN ({format_strings})
        """, (service_line, *month_list))
        rows = cursor.fetchall()

        if not rows:
            return {"status": "error", "message": "No data for service line"}

        deviation = {row["month"]: {
            "overall_avg": row["overall_avg"],
            "genai_avg": row["genai_avg"],
            "dps_ranking_avg": row["dps_ranking_avg"],
            "performance_avg": row["performance_avg"],
            "activity_avg": row["activity_avg"],
            "collaboration_avg": row["collaboration_avg"],
            "efficiency_avg": row["efficiency_avg"],
        } for row in rows}

        # Fetch employees in this service line
        cursor.execute("""
            SELECT DISTINCT Employee_id, Name
            FROM employee_data
            WHERE Service_line = %s
        """, (service_line,))
        employees = cursor.fetchall()

        cursor.close()
        conn.close()

        return {
            "service_line": service_line,
            "months": month_list,
            "data": deviation,
            "employees": employees
        }

    except Error as e:
        return {"status": "error", "message": str(e)}




@app.get("/employee-month-compare")
def employee_month_compare(name: str, months: int = Query(1, ge=1, le=3)):
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)

        # Current month
        current_month = datetime.utcnow().strftime("%Y-%m")

        # Build list of months: past first, then current
        month_list = []
        for i in range(months, 0, -1):
            past = (datetime.utcnow().replace(day=1) - pd.DateOffset(months=i)).strftime("%Y-%m")
            month_list.append(past)
        month_list.append(current_month)

        # Fetch employee scores for these months
        format_strings = ",".join(["%s"] * len(month_list))
        cursor.execute(f"""
            SELECT Name,month, DPS_Ranking_score, GenAI_Maturity_score,
                   DPS_performance_Ranking_score, DPS_Activity_Ranking_score,
                   DPS_Collaboration_score, DPS_efficiency_Ranking_score
            FROM employee_data
            WHERE Employee_id = %s AND month IN ({format_strings})
        """, (name, *month_list))
        rows = cursor.fetchall()

        if not rows:
            return {"status": "error", "message": "No data for employee"}

        # Organize scores by month
        scores = {row["month"]: {
            "genai_avg": row["GenAI_Maturity_score"],
            "dps_ranking_avg": row["DPS_Ranking_score"],
            "performance_avg": row["DPS_performance_Ranking_score"],
            "activity_avg": row["DPS_Activity_Ranking_score"],
            "collaboration_avg": row["DPS_Collaboration_score"],
            "efficiency_avg": row["DPS_efficiency_Ranking_score"],
        } for row in rows}
        employee_name = rows[0]["Name"]

        cursor.close()
        conn.close()

        return {"name": name, "months": month_list, "scores": scores, "employee_name":employee_name}

    except Error as e:
        return {"status": "error", "message": str(e)}


@app.get("/download-decreased-performance")
def download_decreased_performance(month: str):
    conn = None
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        
        # 1. Fetch current and previous month strings
        current_dt = datetime.strptime(month, "%Y-%m")
        prev_month = (current_dt.replace(day=1) - pd.DateOffset(months=1)).strftime("%Y-%m")

        # 2. Fetch data
        query = "SELECT * FROM employee_data WHERE Month IN (%s, %s)"
        df = pd.read_sql(query, conn, params=(month, prev_month))

        if df.empty:
            raise HTTPException(status_code=404, detail="No data found")

        # 3. Define Rank Mapping for Output
        reverse_rank_map = {
            0: "No Score",
            1: "Bronze",
            2: "Silver",
            3: "Gold"
        }

        score_cols = [
            'GenAI_Maturity_score', 'DPS_Ranking_score', 
            'DPS_performance_Ranking_score', 'DPS_Activity_Ranking_score', 
            'DPS_Collaboration_score', 'DPS_efficiency_Ranking_score'
        ]

        # 4. Calculate average for each row
        df['Row_Score_Avg'] = df[score_cols].mean(axis=1)

        # 5. Group by Employee to handle multiple records/service lines
        monthly_summary = df.groupby(['Employee_id', 'Name', 'Month'])['Row_Score_Avg'].mean().reset_index()

        # 6. Separate into Current and Previous
        curr_month_df = monthly_summary[monthly_summary['Month'] == month]
        prev_month_df = monthly_summary[monthly_summary['Month'] == prev_month]

        # 7. Merge to compare
        comparison = curr_month_df.merge(
            prev_month_df[['Employee_id', 'Row_Score_Avg']], 
            on='Employee_id', 
            suffixes=('_Current', '_Previous')
        )

        # 8. Filter for decreased performance
        decreased = comparison[comparison['Row_Score_Avg_Current'] < comparison['Row_Score_Avg_Previous']].copy()
        
        if decreased.empty:
            raise HTTPException(status_code=404, detail="No employees found with decreased performance")

        # 9. APPLY ROUNDING AND MAPPING
        # Calculate drop amount (kept as float for detail)
        decreased['Drop_Amount'] = (decreased['Row_Score_Avg_Previous'] - decreased['Row_Score_Avg_Current']).round(2)

        # Map current month rank (Round 1.9 -> 2 -> Silver; 1.2 -> 1 -> Bronze)
        decreased['Current_Rank'] = decreased['Row_Score_Avg_Current'].round(0).astype(int).map(reverse_rank_map)
        
        # Map previous month rank
        decreased['Previous_Rank'] = decreased['Row_Score_Avg_Previous'].round(0).astype(int).map(reverse_rank_map)

        # 10. Final Column Selection for Excel
        final_excel_df = decreased[[
            'Employee_id', 
            'Name', 
            'Previous_Rank', 
            'Current_Rank', 
            'Drop_Amount'
        ]]

        # 11. Generate Excel
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            final_excel_df.to_excel(writer, index=False, sheet_name='Decreased_Performance')
            
            # Optional: Add simple formatting
            worksheet = writer.sheets['Decreased_Performance']
            for i, col in enumerate(final_excel_df.columns):
                column_len = max(final_excel_df[col].astype(str).map(len).max(), len(col)) + 2
                worksheet.set_column(i, i, column_len)
        
        output.seek(0)
        return StreamingResponse(
            output, 
            headers={'Content-Disposition': f'attachment; filename="Decreased_Report_{month}.xlsx"'},
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn: conn.close()