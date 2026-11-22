import numpy as np, lameenc, wave, os

SR = 44100
DUR = 150.0  # 2.5 minutes
n = int(SR * DUR)
t_all = np.arange(n) / SR

# ---------------------------------------------------------------- harmony bed
# Gentle, slow-moving chords (D major-ish, warm and open): D - Bm - G - A
chords = [
    [146.83, 220.00, 293.66, 369.99],   # D3 A3 D4 F#4
    [123.47, 185.00, 246.94, 293.66],   # B2 F#3 B3 D4
    [98.00,  146.83, 196.00, 246.94],   # G2 D3 G3 B3
    [110.00, 164.81, 220.00, 277.18],   # A2 E3 A3 C#4
]
bar = 12.0  # seconds per chord

pad = np.zeros(n, dtype=np.float64)
for i, chord in enumerate(chords * int(np.ceil(DUR / (bar * len(chords)))) ):
    start = i * bar
    if start >= DUR:
        break
    seg = max(0, min(n, int((start + bar) * SR)) - int(start * SR))
    if seg <= 0:
        continue
    tt = np.arange(seg) / SR
    env = np.minimum(1, tt / 3.0) * np.minimum(1, np.maximum(0, (bar + 1.5 - tt)) / 4.0)
    env = np.clip(env, 0, 1)
    local = np.zeros(seg)
    for f in chord:
        for det in (-0.12, 0.12):
            local += 0.045 * np.sin(2 * np.pi * (f + det) * tt) * (0.75 + 0.25 * np.sin(2*np.pi*0.07*tt + f))
        local += 0.018 * np.sin(2 * np.pi * f * 2 * tt)
    pad[int(start*SR):int(start*SR)+seg] += local * env

# ---------------------------------------------------------------- melody notes
rng = np.random.default_rng(7)
scale = [293.66, 329.63, 369.99, 440.00, 493.88, 587.33, 659.25]  # D E F# A B D E

def pluck(freq, dur=3.2, amp=0.20):
    length = int(dur * SR)
    tt = np.arange(length) / SR
    env = (1 - np.exp(-tt / 0.012)) * np.exp(-tt / 1.5)
    # soft hammered tone: fundamental + warm overtones with faster decay
    s = (np.sin(2*np.pi*freq*tt) +
         0.42 * np.sin(2*np.pi*freq*2*tt) * np.exp(-tt/0.9) +
         0.16 * np.sin(2*np.pi*freq*3*tt) * np.exp(-tt/0.5) +
         0.05 * np.sin(2*np.pi*freq*4.02*tt) * np.exp(-tt/0.35))
    return amp * s * env

mel = np.zeros(n)
pos = 2.0
note_idx = 2
while pos < DUR - 4:
    step = rng.choice([1.6, 2.0, 2.4, 3.2])
    jump = rng.choice([-2, -1, -1, 0, 1, 1, 2])
    note_idx = int(np.clip(note_idx + jump, 0, len(scale) - 1))
    f = scale[note_idx]
    sig = pluck(f, amp=0.16 + rng.random() * 0.05)
    s0 = int(pos * SR)
    e0 = min(n, s0 + len(sig))
    mel[s0:e0] += sig[:e0 - s0]
    # occasional soft high echo
    if rng.random() < 0.35:
        sig2 = pluck(f * 2, dur=2.0, amp=0.05)
        s1 = min(n, s0 + int(0.42 * SR))
        e1 = min(n, s1 + len(sig2))
        mel[s1:e1] += sig2[:e1 - s1]
    pos += step

# ---------------------------------------------------------------- reverb (simple schroeder-ish)
def reverb(sig, delays=(0.031, 0.047, 0.061, 0.083), gains=(0.32, 0.26, 0.2, 0.14)):
    out = sig.copy()
    for d, g in zip(delays, gains):
        k = int(d * SR)
        out[k:] += g * out[:-k]
    return out

mix = pad * 0.5 + mel
mix = reverb(mix)
# very light stereo widening by delaying right channel
left = mix
right = np.concatenate([np.zeros(int(0.009*SR)), mix[:-int(0.009*SR)]])
stereo = np.stack([left, right], axis=1)

# normalise + gentle fade in/out + soft limiter
stereo = stereo / np.max(np.abs(stereo)) * 1.25
stereo = np.tanh(stereo)
fade_in = int(3 * SR); fade_out = int(6 * SR)
stereo[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
stereo[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None] ** 1.5
pcm = (stereo * 0.72 * 32767).astype(np.int16)

enc = lameenc.Encoder()
enc.set_bit_rate(128)
enc.set_in_sample_rate(SR)
enc.set_channels(2)
enc.set_quality(2)
mp3 = enc.encode(pcm.tobytes()) + enc.flush()
out = "/home/user/sistema/public/audio/jardin-ambiente.mp3"
with open(out, "wb") as f:
    f.write(bytes(mp3))
print("wrote", out, round(os.path.getsize(out)/1024/1024, 2), "MB", DUR, "s")
