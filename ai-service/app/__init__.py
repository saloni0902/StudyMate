import os

# FAISS and PyTorch each ship their own copy of OpenMP (libomp). On macOS,
# whichever copy starts second aborts the process ("OMP: Error #15").
# KMP_DUPLICATE_LIB_OK lets both run; limiting OpenMP to one thread keeps
# that safe, and our workload (short texts, exact search) doesn't need more.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("OMP_NUM_THREADS", "1")
