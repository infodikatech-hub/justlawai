
import os

file_path = "main.py"
print(f"Reading {file_path}...")

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

# Range to remove: 475 to 543 (1-based)
# 1-based 475 is index 474
# 1-based 543 is index 542
# We want to remove everything from index 474 to 542 inclusive.
# So we keep lines[:474] and lines[543:]

start_idx = 474
end_idx = 543 # Start of what we keep (Line 544 is index 543)

print(f"Removing lines {start_idx+1} to {end_idx} (indices {start_idx}:{end_idx})")
print(f"First removed line: {lines[start_idx].strip()}")
print(f"Last removed line: {lines[end_idx-1].strip()}")
print(f"Next kept line: {lines[end_idx].strip()}")

new_lines = lines[:start_idx] + lines[end_idx:]

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print(f"Written {len(new_lines)} lines to {file_path}")
