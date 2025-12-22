"""
PWA Icon Generator for JustLaw
Generates all required icon sizes from the base logo
"""

import os
from PIL import Image, ImageDraw

# Desired icon sizes
ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

# Output directory
OUTPUT_DIR = "icons"

# JustLaw gold color
GOLD_COLOR = (245, 158, 11)  # #F59E0B
BG_COLOR = (15, 15, 15)  # #0f0f0f - dark background

def create_icons():
    """Create PWA icons with the JustLaw scale design"""
    
    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    for size in ICON_SIZES:
        # Create a new image with dark background
        img = Image.new('RGBA', (size, size), BG_COLOR + (255,))
        draw = ImageDraw.Draw(img)
        
        # Scale factor
        s = size / 100
        
        # Draw the scale (terazi) design
        
        # Center post
        draw.rectangle(
            [int(47*s), int(20*s), int(53*s), int(70*s)],
            fill=GOLD_COLOR
        )
        
        # Top bar
        draw.rectangle(
            [int(20*s), int(18*s), int(80*s), int(24*s)],
            fill=GOLD_COLOR
        )
        
        # Left chain
        draw.rectangle(
            [int(24*s), int(24*s), int(27*s), int(46*s)],
            fill=GOLD_COLOR
        )
        
        # Right chain
        draw.rectangle(
            [int(73*s), int(24*s), int(76*s), int(46*s)],
            fill=GOLD_COLOR
        )
        
        # Left pan (ellipse)
        bbox_left = [int(11.5*s), int(45*s), int(39.5*s), int(55*s)]
        draw.ellipse(bbox_left, fill=GOLD_COLOR)
        
        # Right pan (ellipse)
        bbox_right = [int(60.5*s), int(45*s), int(88.5*s), int(55*s)]
        draw.ellipse(bbox_right, fill=GOLD_COLOR)
        
        # Base
        draw.rectangle(
            [int(35*s), int(70*s), int(65*s), int(76*s)],
            fill=GOLD_COLOR
        )
        draw.rectangle(
            [int(42*s), int(76*s), int(58*s), int(84*s)],
            fill=GOLD_COLOR
        )
        
        # Save icon
        output_path = os.path.join(OUTPUT_DIR, f"icon-{size}x{size}.png")
        img.save(output_path, 'PNG')
        print(f"Created: {output_path}")
    
    # Create maskable icon (512x512 with padding)
    maskable_size = 512
    padding = int(maskable_size * 0.1)  # 10% padding for safe zone
    
    img = Image.new('RGBA', (maskable_size, maskable_size), GOLD_COLOR + (255,))
    draw = ImageDraw.Draw(img)
    
    # Inner dark circle
    inner_size = maskable_size - (padding * 2)
    draw.ellipse(
        [padding, padding, maskable_size - padding, maskable_size - padding],
        fill=BG_COLOR + (255,)
    )
    
    # Draw scale in center with adjusted scale
    center = maskable_size / 2
    s = inner_size / 120  # Slightly smaller to fit in circle
    offset_x = center - (50 * s)
    offset_y = center - (50 * s)
    
    def offset_rect(x1, y1, x2, y2):
        return [offset_x + x1*s, offset_y + y1*s, offset_x + x2*s, offset_y + y2*s]
    
    # Center post
    draw.rectangle(offset_rect(47, 20, 53, 70), fill=GOLD_COLOR)
    # Top bar
    draw.rectangle(offset_rect(20, 18, 80, 24), fill=GOLD_COLOR)
    # Left chain
    draw.rectangle(offset_rect(24, 24, 27, 46), fill=GOLD_COLOR)
    # Right chain
    draw.rectangle(offset_rect(73, 24, 76, 46), fill=GOLD_COLOR)
    # Left pan
    draw.ellipse(offset_rect(11.5, 45, 39.5, 55), fill=GOLD_COLOR)
    # Right pan
    draw.ellipse(offset_rect(60.5, 45, 88.5, 55), fill=GOLD_COLOR)
    # Base
    draw.rectangle(offset_rect(35, 70, 65, 76), fill=GOLD_COLOR)
    draw.rectangle(offset_rect(42, 76, 58, 84), fill=GOLD_COLOR)
    
    maskable_path = os.path.join(OUTPUT_DIR, "maskable-icon.png")
    img.save(maskable_path, 'PNG')
    print(f"Created: {maskable_path}")
    
    print("\n✅ All PWA icons generated successfully!")

if __name__ == "__main__":
    create_icons()
