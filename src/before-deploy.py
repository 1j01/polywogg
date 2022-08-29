import re
fpath = "src/main.ts"
with open(fpath, "r+") as f:
    code = f.read()
    pattern = r'skipReadyWaiting = (true|false);'
    if re.findall(pattern, code):
        code = re.sub(pattern, 'skipReadyWaiting = false;', code)
        f.seek(0)
        f.write(code)
        f.truncate()
    else:
        print("Regular expression '{}' not found in {}".format(pattern, fpath))
        print("before-deploy.py needs to be updated")
        exit(1)
