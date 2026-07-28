from pydantic import BaseModel, Field
class Result(BaseModel):
    missing_fields: list[str] = Field(default_factory=list)

r = Result(missing_fields=[])
print(not getattr(r, "missing_fields", []))
