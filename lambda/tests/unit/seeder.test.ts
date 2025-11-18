import * as fs from 'fs';
import * as path from 'path';

describe('Seeder COPY to INSERT Conversion', () => {
  /**
   * Convert PostgreSQL COPY ... FROM stdin format to INSERT statements
   * This is duplicated from seeder.ts for testing purposes
   */
  function convertCopyToInsert(sql: string): string {
    const lines = sql.split('\n');
    const result: string[] = [];
    let inCopyBlock = false;
    let tableName = '';
    let columns = '';
    
    for (const line of lines) {
      const copyMatch = line.match(/^COPY\s+(\w+)\s*\(([^)]+)\)\s+FROM\s+stdin;/i);
      
      if (copyMatch) {
        // Start of COPY block
        inCopyBlock = true;
        tableName = copyMatch[1];
        columns = copyMatch[2];
        continue;
      }
      
      if (line === '\\.' || line.trim() === '\\.') {
        // End of COPY block
        inCopyBlock = false;
        tableName = '';
        columns = '';
        continue;
      }
      
      if (inCopyBlock && line.trim()) {
        // Convert data line to INSERT
        const values = line.split('\t').map(v => {
          if (!v || v === '\\N') return 'NULL';
          // Escape single quotes and wrap in quotes
          return `'${v.replace(/'/g, "''")}'`;
        }).join(', ');
        
        result.push(`INSERT INTO ${tableName} (${columns}) VALUES (${values});`);
      } else if (!inCopyBlock) {
        // Keep non-COPY statements as-is
        result.push(line);
      }
    }
    
    return result.join('\n');
  }

  it('should convert simple COPY statement to INSERT', () => {
    const input = `CREATE TABLE test (id int, name text);
COPY test (id, name) FROM stdin;
1\tAlice
2\tBob
\\.
`;

    const result = convertCopyToInsert(input);
    expect(result).toContain('CREATE TABLE test (id int, name text);');
    expect(result).toContain("INSERT INTO test (id, name) VALUES ('1', 'Alice');");
    expect(result).toContain("INSERT INTO test (id, name) VALUES ('2', 'Bob');");
  });

  it('should handle NULL values (\\N)', () => {
    const input = `COPY test (id, name, age) FROM stdin;
1\tAlice\t30
2\tBob\t\\N
\\.
`;

    const result = convertCopyToInsert(input);
    expect(result).toContain("INSERT INTO test (id, name, age) VALUES ('1', 'Alice', '30');");
    expect(result).toContain("INSERT INTO test (id, name, age) VALUES ('2', 'Bob', NULL);");
  });

  it('should escape single quotes in values', () => {
    const input = `COPY test (id, name) FROM stdin;
1\tO'Brien
\\.
`;

    const result = convertCopyToInsert(input);
    expect(result).toContain("INSERT INTO test (id, name) VALUES ('1', 'O''Brien');");
  });

  it('should preserve CREATE statements', () => {
    const input = `CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE countries (id int, name text);
COPY countries (id, name) FROM stdin;
1\tUSA
\\.
`;

    const result = convertCopyToInsert(input);
    expect(result).toContain('CREATE EXTENSION IF NOT EXISTS postgis;');
    expect(result).toContain('CREATE TABLE countries (id int, name text);');
  });

  it('should handle multiple columns with complex data', () => {
    const input = `COPY countries (id, name, border) FROM stdin;
1\tAntigua and Barbuda\t0106000020E61000000200000001030000000100000004000000DC9AADBCE4D74EC0
\\.
`;

    const result = convertCopyToInsert(input);
    expect(result).toContain('INSERT INTO countries (id, name, border) VALUES');
    expect(result).toContain("'Antigua and Barbuda'");
    expect(result).toContain("'0106000020E61000000200000001030000000100000004000000DC9AADBCE4D74EC0'");
  });

  it('should skip empty lines in COPY block', () => {
    const input = `COPY test (id, name) FROM stdin;
1\tAlice

2\tBob
\\.
`;

    const result = convertCopyToInsert(input);
    const insertCount = (result.match(/INSERT INTO/g) || []).length;
    expect(insertCount).toBe(2); // Should only have 2 inserts, not 3
  });

  it('should handle real PostGIS seed data sample', () => {
    const sampleSql = `CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;

CREATE TABLE countries (
    id integer NOT NULL PRIMARY KEY,
    name character varying(256),
    border geometry(MultiPolygon,4326)
);

COPY countries (id, name, border) FROM stdin;
1\tAntigua and Barbuda\t0106000020E6100000020000000103
2\tAlgeria\t0106000020E610000001000000010300000001
\\.

SELECT * FROM countries;
`;

    const result = convertCopyToInsert(sampleSql);
    
    // Should preserve CREATE statements
    expect(result).toContain('CREATE EXTENSION IF NOT EXISTS postgis');
    expect(result).toContain('CREATE TABLE countries');
    
    // Should have INSERT statements
    expect(result).toContain('INSERT INTO countries (id, name, border) VALUES');
    expect(result).toContain("'Antigua and Barbuda'");
    expect(result).toContain("'Algeria'");
    
    // Should preserve trailing SELECT
    expect(result).toContain('SELECT * FROM countries;');
    
    // Should NOT contain COPY syntax
    expect(result).not.toContain('COPY countries');
    expect(result).not.toContain('FROM stdin');
  });

  it('should handle COPY with capitals table', () => {
    const input = `CREATE TABLE capitals (
    id integer NOT NULL PRIMARY KEY,
    name character varying(256),
    country_id integer
);

COPY capitals (id, name, country_id) FROM stdin;
1\tSt. John's\t1
2\tAlgiers\t2
\\.
`;

    const result = convertCopyToInsert(input);
    expect(result).toContain('INSERT INTO capitals (id, name, country_id) VALUES');
    expect(result).toContain("'St. John''s'"); // Note the escaped quote
    expect(result).toContain("'Algiers'");
  });
});
