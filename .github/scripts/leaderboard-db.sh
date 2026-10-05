#!/usr/bin/env bash
# Gets the leaderboard's D1 database ready for a deploy: creates it if it
# doesn't exist yet, puts its ID in wrangler.toml, and applies any
# migrations it hasn't had. Run it from the repo's root, before deploying,
# so new code never meets an old table. Migrations should only ever add, as
# the code already deployed keeps running against them until the deploy
# finishes.
#
# Usage: .github/scripts/leaderboard-db.sh production|preview
set -euo pipefail

environment="${1:-}"
case "$environment" in
production) name=portfolio-leaderboard ;;
preview) name=portfolio-leaderboard-preview ;;
*)
	echo "Usage: $0 production|preview" >&2
	exit 1
	;;
esac

wrangler="$PWD/node_modules/.bin/wrangler"
# Away from wrangler.toml, so Wrangler looks the database up by name, rather
# than by the placeholder ID, and doesn't offer to add it to the config.
elsewhere="${RUNNER_TEMP:-$(mktemp -d)}"

find_id() {
	(cd "$elsewhere" && "$wrangler" d1 list --json) |
		jq -r --arg name "$name" '.[] | select(.name == $name) | .uuid'
}

id="$(find_id)"
if [ -z "$id" ]; then
	echo "Creating the $environment database, $name"
	(cd "$elsewhere" && "$wrangler" d1 create "$name")
	id="$(find_id)"
fi
if [ -z "$id" ]; then
	echo "Couldn't find or create the $environment database, $name" >&2
	exit 1
fi

sed -i "s/<$environment-database-id>/$id/" wrangler.toml
if [ "$environment" = production ]; then
	"$wrangler" d1 migrations apply leaderboard --remote --env production
else
	"$wrangler" d1 migrations apply leaderboard --remote
fi
