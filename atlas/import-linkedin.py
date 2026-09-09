"""Prepare a local Prospecting import. Never prints contacts or message content.

Usage: python atlas/import-linkedin.py EXPORT.zip OUTPUT.json --date YYYY-MM-DD
Only Connections and one-to-one message metadata are retained. No extraction to disk.
"""
import argparse
import collections
import csv
import datetime as dt
import hashlib
import io
import json
import re
import urllib.parse as urlparse
import zipfile


def profile_url(value):
    try:
        url = urlparse.urlsplit(value.strip())
        host = (url.hostname or '').lower()
        path = url.path.rstrip('/').split('/')
        if url.scheme not in ('http', 'https') or url.username or url.password or url.port:
            return ''
        if not (host == 'linkedin.com' or host.endswith('.linkedin.com')) or len(path) != 3 or path[1].lower() != 'in':
            return ''
        slug = urlparse.unquote(path[2]).lower()
        if not slug or re.search(r'[\s/\\?#]', slug):
            return ''
        return 'https://www.linkedin.com/in/' + urlparse.quote(slug, safe="-_.!~*'()")
    except ValueError:
        return ''


def prepare(path, exported_on):
    dt.date.fromisoformat(exported_on)
    stats = collections.Counter()
    with zipfile.ZipFile(path) as archive:
        def rows(name, header=None):
            member = archive.getinfo(name)
            if member.file_size > 100 * 1024 * 1024:
                raise ValueError('Export member exceeds 100 MB')
            text = archive.read(name).decode('utf-8-sig')
            if header:
                lines = text.splitlines(keepends=True)
                start = next(i for i, line in enumerate(lines) if line.startswith(header))
                text = ''.join(lines[start:])
            return list(csv.DictReader(io.StringIO(text)))

        profile = rows('Profile.csv')[0]
        owner_name = (profile['First Name'] + ' ' + profile['Last Name']).strip().casefold()
        messages = rows('messages.csv')
        owners = {profile_url(r['SENDER PROFILE URL']) for r in messages if r['FROM'].strip().casefold() == owner_name}
        owners.discard('')
        if len(owners) != 1:
            raise ValueError('The export owner could not be matched uniquely')
        owner = owners.pop()
        contacts = {}

        def contact(url, name):
            if not url or url == owner or not name.strip() or name.strip().casefold() == 'linkedin member':
                return None
            if url not in contacts:
                contacts[url] = dict(uid='li-' + hashlib.sha256(url.encode()).hexdigest()[:24], url=url,
                    name=name.strip(), first=name.strip().split()[0], title='', co='', email='', connectedOn='',
                    inboundCount=0, outboundCount=0, lastInboundAt='', lastOutboundAt='')
            return contacts[url]

        for row in rows('Connections.csv', 'First Name,Last Name,'):
            stats['connectionRows'] += 1
            url = profile_url(row['URL'])
            c = contact(url, (row['First Name'] + ' ' + row['Last Name']).strip())
            if c is None:
                stats['unmatchedConnections'] += 1
                continue
            c.update(first=row['First Name'].strip(), title=row['Position'].strip(), co=row['Company'].strip(), email=row['Email Address'].strip(),
                     connectedOn=dt.datetime.strptime(row['Connected On'], '%d %b %Y').date().isoformat() if row['Connected On'] else '')
        stats['connections'] = len(contacts)

        # Count only uniquely identified, non-draft, one-to-one messages. Exclude
        # entire group conversations, including messages with partial recipients.
        participants = collections.defaultdict(set)
        parsed = []
        for row in messages:
            stats['messageRows'] += 1
            if row['IS MESSAGE DRAFT'].lower() != 'no' or row['IS CONVERSATION DRAFT'].lower() != 'no':
                stats['draftMessagesExcluded'] += 1
                continue
            sender = profile_url(row['SENDER PROFILE URL'])
            recipients = [profile_url(u) for u in re.findall(r'https?://[^\s,;|]+', row['RECIPIENT PROFILE URLS'])]
            recipients = set(recipients)
            participants[row['CONVERSATION ID']].update({sender, *recipients})
            parsed.append((row, sender, recipients))
        seen = set()
        for row, sender, recipients in parsed:
            parties = participants[row['CONVERSATION ID']]
            if len(parties) != 2 or '' in parties or owner not in parties or len(recipients) != 1:
                stats['ambiguousOrGroupMessagesExcluded'] += 1
                continue
            outgoing = sender == owner
            target = next(iter(recipients)) if outgoing else sender
            if not outgoing and recipients != {owner}:
                stats['ambiguousOrGroupMessagesExcluded'] += 1
                continue
            name = row['TO'] if outgoing else row['FROM']
            c = contact(target, name)
            if c is None:
                stats['unidentifiedMessagesExcluded'] += 1
                continue
            fingerprint = hashlib.sha256(json.dumps(row, sort_keys=True).encode()).digest()
            if fingerprint in seen:
                stats['duplicateMessagesExcluded'] += 1
                continue
            seen.add(fingerprint)
            timestamp = dt.datetime.strptime(row['DATE'], '%Y-%m-%d %H:%M:%S UTC').replace(tzinfo=dt.timezone.utc).isoformat().replace('+00:00', 'Z')
            direction = 'Outbound' if outgoing else 'Inbound'
            c[direction.lower() + 'Count'] += 1
            c['last' + direction + 'At'] = max(c['last' + direction + 'At'], timestamp)
            stats['messagesIncluded'] += 1
        stats['messageOnlyContacts'] = len(contacts) - stats['connections']
        stats['contactsWithMessages'] = sum(bool(c['inboundCount'] or c['outboundCount']) for c in contacts.values())
        records = sorted(contacts.values(), key=lambda c: c['url'])
        payload = dict(app='chambers-hq-linkedin', version=1, exportedOn=exported_on, contacts=records)
        return payload, dict(stats)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive')
    parser.add_argument('output')
    parser.add_argument('--date', required=True)
    args = parser.parse_args()
    payload, stats = prepare(args.archive, args.date)
    with open(args.output, 'w') as out:
        json.dump(payload, out, ensure_ascii=False, separators=(',', ':'))
        out.write('\n')
    print(json.dumps(stats, sort_keys=True))
