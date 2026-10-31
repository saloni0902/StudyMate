from app.chunker import CHUNK_SIZE, chunk_pages, chunk_text


def test_short_text_is_one_chunk():
    assert chunk_text("A process is a program in execution. It has a PCB.") == [
        "A process is a program in execution. It has a PCB."
    ]


def test_long_text_is_split_with_overlap():
    sentences = [f"Sentence number {i} explains a different scheduling idea." for i in range(60)]
    chunks = chunk_text(" ".join(sentences))
    assert len(chunks) > 1
    assert all(len(c) <= CHUNK_SIZE for c in chunks)
    # The start of each chunk repeats the end of the previous one.
    for prev, nxt in zip(chunks, chunks[1:]):
        assert nxt.split(". ")[0] in prev


def test_very_long_sentence_is_hard_split():
    chunks = chunk_text("word " * 600)
    assert all(len(c) <= CHUNK_SIZE for c in chunks)


def test_chunks_keep_their_page_and_drop_tiny_text():
    pages = [{"page": 1, "text": "Deadlock needs four conditions to hold at once."}, {"page": 2, "text": "12"}]
    assert chunk_pages(pages) == [{"page": 1, "text": "Deadlock needs four conditions to hold at once."}]
