import struct
import zlib

def create_png(size, filename):
    width = height = size
    pixels = []
    center = size / 2
    radius = size / 2 - 1
    
    for y in range(height):
        row = []
        for x in range(width):
            dx = x - center
            dy = y - center
            dist = (dx*dx + dy*dy) ** 0.5
            
            if dist <= radius:
                row.extend([255, 107, 53, 255])
            elif dist <= radius + 1:
                alpha = int(255 * (radius + 1 - dist))
                row.extend([255, 107, 53, alpha])
            else:
                row.extend([0, 0, 0, 0])
        pixels.append(bytes(row))
    
    def chunk(chunk_type, data):
        c = chunk_type + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    
    raw = b''
    for row in pixels:
        raw += b'\x00' + row
    
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    
    with open(filename, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(chunk(b'IHDR', ihdr))
        f.write(chunk(b'IDAT', zlib.compress(raw)))
        f.write(chunk(b'IEND', b''))

create_png(16, 'icons/icon16.png')
create_png(48, 'icons/icon48.png')
create_png(128, 'icons/icon128.png')
print('Icons created')
