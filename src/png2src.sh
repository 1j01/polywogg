#!/bin/bash
# (I'm not 100% sure bash is needed specifically.)

# This has to be in build/ so that `w4 watch` ignores it.
# There's no way to specify custom ignore patterns.
FOLDER=build/png2src-generated

mkdir -p $FOLDER
rm $FOLDER/*

INI_FILE=$FOLDER/png2mem.ini

for f in src/png/*.png
do
	# Alright, I'm doing something crazy here:
	# I'm using `w4 png2src`'s built-in mustache template support
	# but then also modifying the output with `sed` here.
	# So it's like a double templated file.
	# I'm also doing this in order to allow hotswapping image data using `scanmem`, which is pretty crazy.
	# (See png2mem.py)
	START_SENTINEL_BYTES=$(echo -n "MEM_START_SENTINEL" "$f" | xxd -i | tr -d '\r\n')
	END_SENTINEL_BYTES=$(echo -n "MEM_END_SENTINEL" "$f" | xxd -i | tr -d '\r\n')
	# WHY does this not work??? sed can't do a |??
	# echo "Start sentinel for scanmem: $(echo -n "$START_SENTINEL_BYTES" | sed 's/0x|,//g')"
	# echo "Start sentinel for scanmem: $(echo -n "$START_SENTINEL_BYTES" | sed 's/(0x|,)//g')"
	# Also can't do \s+??? what is going on here?
	# This is probably some escaping problem, because this is bash.
	# echo "Start sentinel for scanmem: $(echo -n "$START_SENTINEL_BYTES" | sed 's/0x//g' | sed 's/,//g' | sed 's/\\s+/ /g')"
	# echo "End sentinel for scanmem: $(echo -n "$END_SENTINEL_BYTES" | sed 's/0x//g' | sed 's/,//g' | sed 's/\\s+/ /g')"
	START_SENTINEL_BYTES_SCANMEM=$(echo -n "$START_SENTINEL_BYTES" | sed 's/0x//g' | sed 's/,//g' | sed 's/  / /g' | sed 's/^ //g' | sed 's/ $//g')
	END_SENTINEL_BYTES_SCANMEM=$(echo -n "$END_SENTINEL_BYTES" | sed 's/0x//g' | sed 's/,//g' | sed 's/  / /g' | sed 's/^ //g' | sed 's/ $//g')
	echo "Start sentinel for scanmem: $START_SENTINEL_BYTES_SCANMEM"
	echo "End sentinel for scanmem:   $END_SENTINEL_BYTES_SCANMEM"

	echo "[$f]" >>$INI_FILE
	echo "START_SENTINEL_BYTES=$START_SENTINEL_BYTES" >>$INI_FILE
	echo "END_SENTINEL_BYTES=$END_SENTINEL_BYTES" >>$INI_FILE
	echo "START_SENTINEL_BYTES_SCANMEM=$START_SENTINEL_BYTES_SCANMEM" >>$INI_FILE
	echo "END_SENTINEL_BYTES_SCANMEM=$END_SENTINEL_BYTES_SCANMEM" >>$INI_FILE

	# Had to pipe to a file since the --output option didn't work for me.
	w4 png2src \
		--template src/png2src-template.ts.mustache \
		$f \
		| sed "s/START_SENTINEL_BYTES/$START_SENTINEL_BYTES/g" \
		| sed "s/END_SENTINEL_BYTES/$END_SENTINEL_BYTES/g" \
		> $FOLDER/$(basename $f .png).ts
done
