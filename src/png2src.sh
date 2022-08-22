#!/bin/bash
# (I'm not 100% sure bash is needed specifically.)

# This has to be in build/ so that `w4 watch` ignores it.
# There's no way to specify custom ignore patterns.
FOLDER=build/png2src-generated

mkdir -p $FOLDER
rm $FOLDER/*

for f in src/png/*.png
do
	# Had to use piping since --output option didn't work for me.

	# Alright, I'm doing something crazy here:
	# I'm using `w4 png2src`'s built-in mustache template support
	# but then also modifying the output with `sed` here.
	# So it's like a double templated file.
	# I'm also doing this in order to allow for scanmem, which is pretty crazy.
	START_SENTINEL_BYTES=$(echo -n "MEM_START_SENTINEL" "$f" | xxd -i | tr -d '\r\n')
	END_SENTINEL_BYTES=$(echo -n "MEM_START_SENTINEL" "$f" | xxd -i | tr -d '\r\n')
	# echo "START_SENTINEL_BYTES: $START_SENTINEL_BYTES"
	# echo "END_SENTINEL_BYTES: $END_SENTINEL_BYTES"
	w4 png2src \
		--assemblyscript $f \
		--template src/png2src-template.ts.mustache \
		| sed "s/START_SENTINEL_BYTES/$START_SENTINEL_BYTES/g" \
		| sed "s/END_SENTINEL_BYTES/$END_SENTINEL_BYTES/g" \
		> $FOLDER/$(basename $f .png).ts
done
