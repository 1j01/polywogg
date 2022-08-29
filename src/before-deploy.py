import re
import subprocess

if subprocess.check_output(["git", "status", "--porcelain"], encoding="utf8") != "":
    print("Working directory is not clean! Aborting deploy.")
    exit(1)
if subprocess.check_output(["git", "diff", "origin/main"], encoding="utf8") != "":
    print("Some commits are not pushed. Aborting deploy.")
    exit(1)

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
