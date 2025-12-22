import os
from PIL import Image

def convert_images_to_webp(search_dir):
    # Supported formats to convert
    extensions = ['.png', '.jpg', '.jpeg']
    
    print(f"Scanning {search_dir} for images...")

    for root, dirs, files in os.walk(search_dir):
        for file in files:
            file_path = os.path.join(root, file)
            filename, ext = os.path.splitext(file)
            
            if ext.lower() in extensions:
                try:
                    # Construct new filename
                    new_file_path = os.path.join(root, filename + ".webp")
                    
                    # Convert only if webp doesn't exist or is older
                    if not os.path.exists(new_file_path):
                        with Image.open(file_path) as img:
                            img.save(new_file_path, "WEBP", quality=85)
                            print(f"Converted: {file} -> {filename}.webp")
                    else:
                        print(f"Skipping {file}, webp exists.")
                        
                except Exception as e:
                    print(f"Error converting {file}: {e}")

if __name__ == "__main__":
    # Target directory is the images folder in frontend
    target_dir = os.path.join(os.getcwd(), 'frontend', 'images')
    if os.path.exists(target_dir):
        convert_images_to_webp(target_dir)
    else:
        print(f"Directory not found: {target_dir}")
