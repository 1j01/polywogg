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
	w4 png2src --assemblyscript $f --template src/png2src-template.ts.mustache > $FOLDER/$(basename $f .png).ts
done
