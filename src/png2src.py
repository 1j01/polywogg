#!/usr/bin/env python3

import configparser
import glob, os
from subprocess import run
import re

# This folder has to be in build/ so that `w4 watch` ignores it.
# There's no way to specify custom ignore patterns.
folder = "build/png2src-generated"

ini_file = os.path.join(folder, "png2mem.ini")

# Ensure the folder exists
os.makedirs(folder, exist_ok=True)

# Empty the folder
for f in os.listdir(folder):
    os.remove(os.path.join(folder, f))


config = configparser.ConfigParser()

for f in glob.glob("src/png/*.png"):
	# To enable hot-swapping image data, I'm using sentinel values
	# surrounding the image data so that I can use scanmem to find and edit the memory externally.
	# (See png2mem.py)
	start_sentinel_str = "MEM_START_SENTINEL_" + f
	end_sentinel_str = "MEM_END_SENTINEL_" + f
	start_sentinel_bytes = start_sentinel_str.encode()
	end_sentinel_bytes = end_sentinel_str.encode()

	start_sentinel_bytes_scanmem = start_sentinel_bytes.hex(" ")
	end_sentinel_bytes_scanmem = end_sentinel_bytes.hex(" ")

	start_sentinel_bytes_source = "0x" + start_sentinel_bytes_scanmem.replace(" ", ",0x")
	end_sentinel_bytes_source = "0x" + end_sentinel_bytes_scanmem.replace(" ", ",0x")

	config[f] = {
		'START_SENTINEL_BYTES_SOURCE': start_sentinel_bytes_source,
		'END_SENTINEL_BYTES_SOURCE': end_sentinel_bytes_source,
		'START_SENTINEL_BYTES_SCANMEM': start_sentinel_bytes_scanmem,
		'END_SENTINEL_BYTES_SCANMEM': end_sentinel_bytes_scanmem,
	}

	ran = run(["w4", "png2src", "--template", "src/png2src-template.ts.mustache", f], capture_output=True)
	output = ran.stdout.decode().strip()
	if len(ran.stderr) > 0:
		print("w4 png2src command failed:\n", ran.stderr.decode())
		exit(1)

	# Awkward:
	# I'm using `w4 png2src`'s built-in mustache template support
	# but also doing this bespoke replacement, so it's like a double-templated file
	output = output.replace("START_SENTINEL_BYTES", start_sentinel_bytes_source)
	output = output.replace("END_SENTINEL_BYTES", end_sentinel_bytes_source)

	output_path = os.path.join(folder, os.path.basename(f).removesuffix(".png") + ".ts")
	with open(output_path, "w") as out:
		out.write(output)
	
	print("Generated", output_path)

with open(ini_file, 'w') as out:
  config.write(out)

print("Wrote config file for scanmem shenanigans:", ini_file)
