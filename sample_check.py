
raw = """# Title

3705
f(x) = 1
3705
"""
lines = raw.split('
')
print('Lines:', len(lines))
for idx, l in enumerate(lines):
    print(idx, repr(l))
