# Hash Normalization v1

## Scope

`hash_normalization_v1` is used only for Text File Hashes, currently the Axis
Registry reference hashes stored in Research Claim assertion files. Its purpose
is to prevent operating-system newline conversion from producing hash drift.

It does not apply to `assertion_content_v1`, `promotion_content_v1`, Application
hashes, `graph_content_v1`, or `audit_record_v1`. Those Semantic and Audit Hashes
continue to use RFC 8785 JCS followed by SHA-256.

Registry Path resolution is independent from this Hash specification. Current
Research Claim files store Registry paths relative to the Research Project Root
under `path_base: research_project_root`; changing the path contract does not
change normalized Text File Hash output.

## Algorithm

`normalized_text_file_sha256_v1` performs these steps in order:

1. Read the file as bytes.
2. Decode strictly as UTF-8. Invalid UTF-8 produces
   `TEXT_FILE_INVALID_UTF8` instead of an uncaught exception.
3. Remove one leading UTF-8 BOM, if present.
4. Replace CRLF and standalone CR line endings with LF.
5. Encode the resulting text as UTF-8.
6. Calculate SHA-256 and return 64 lowercase hexadecimal characters.

The following are not normalized:

- trailing newlines;
- leading, trailing, or intra-line whitespace;
- Unicode NFC/NFD representation;
- YAML key order, comments, or quotes.

The file is not parsed and reserialized for hashing. This preserves a stable
text representation while changing only BOM and newline differences.

## Versioning

Any future change to these normalization rules must use a new version such as
`hash_normalization_v2` and perform an explicit stored-hash migration.

The per-file CRLF rules introduced before this algorithm were removed from
`.gitattributes`; normalized Text File Hashes no longer depend on checkout line
endings. Registry YAML files themselves were not renormalized.
