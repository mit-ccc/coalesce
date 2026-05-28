# %%
# Import libraries
import json
import os
import random

import dspy
from dotenv import load_dotenv
from tqdm import tqdm

load_dotenv()
open_ai_api_key = os.getenv("OPENAI_API_KEY")
# %%
gpt4 = dspy.OpenAI(model="gpt-4-0125-preview", max_tokens=1100, api_key=open_ai_api_key)
dspy.configure(lm=gpt4)

# %%
# print model name
# print(f"{gpt4}")

# gpt4("which openai model are you? Are you gpt4?")
# %%
# Create a signature


class CreateQuestions(dspy.Signature):
    """Create a variety of questions from a prompt. All of these questions will be asked to community members in an online survey to inform a decision around city resources and services.
    The number of questions to generate is given as an input.
    Please generate questions that are different from the ones already generated, which are inputted.
    The output should be a list of JSONs with the following structure:
    [
        {
            "response_format": "open" or "closed",
            "description": string,
            "main_text": string,
            "response_categories": empty list for open questions or list of JSONs with an "id" and "text" field for closed questions
        }
    ]"""

    number = dspy.InputField(
        desc="An integer representing the number of questions to generate."
    )
    prompt = dspy.InputField(desc="The prompt to generate questions from.")
    prev_questions = dspy.InputField(
        desc="A list of questions that have already been generated. Each question is separated by a semi-colon."
    )
    # output_format = dspy.InputField(desc="The format of the output, which will be a JSON.")
    questions = dspy.OutputField(desc="The generated questions.")


# %%
# Test out CreateQuestions

# defining the predictor
question_generator = dspy.ChainOfThought(CreateQuestions)

# defining the input
# test_input = {
#     "number": "3",
#     "prompt": "Generate behavioral questions, which ask for data on the frequency and way in which particular actions are performed. Try to generate a range of obviously behavioral and less obviously behavioral questions.",
# }

question_qualities = """
(1) Question should meet a third-grade reading level.
(2) Question should not contain basic spelling or grammar mistakes.
(3) Question should be concise.
(4) Question should not contain potential jargon (e.g. special words or expressions that are used by a particular profession or group and are difficult for others to understand) that are not defined.
(5) Question should not contain any acronyms that are not defined.
(6) Question should not mention proper nouns (e.g. names of people, places, or organizations) without describing what they are.
(7) Question should be in active voice.
(8) Question should have minimal propositions.
(9) Question should have minimal logical operators.
(10) Question should not have negatives or double negatives."""

question_type = "open-ended"

# score of 1.0
# alignment_level = f"uphold all qualities"

# score of 0.7
# # randomly pick a number between 2 and 4 inclusive
# number_qualities = random.randint(2, 4)
# # randomly sample number_qualities from 1 to 10, inclusive
# qualities = random.sample(range(1, 11), number_qualities)
# # convert qualities to comma-separated string
# qualities_str = ", ".join([str(quality) for quality in qualities])
# print(number_qualities, qualities, qualities_str)
# alignment_level = f"do not uphold qualities {qualities_str} but uphold the rest"

# score of 0.5
# # randomly sample 5 from 1 to 10, inclusive
# qualities = random.sample(range(1, 11), 5)
# # convert qualities to comma-separated string
# qualities_str = ", ".join([str(quality) for quality in qualities])
# print(qualities, qualities_str)
# alignment_level = f"do not uphold qualities {qualities_str} but uphold the rest"

# score of 0.3 (takes a while to run)
# # randomly pick a number between six and eight inclusive
# number_qualities = random.randint(6, 8)
# # randomly sample number_qualities from 1 to 10, inclusive
# qualities = random.sample(range(1, 11), number_qualities)
# # convert qualities to comma-separated string
# qualities_str = ", ".join([str(quality) for quality in qualities])
# print(qualities, qualities_str)
# alignment_level = f"do not uphold qualities {qualities_str} but uphold the rest"

# number_qualities = random.randint(2, 4)
# # randomly sample number_qualities from 1 to 10, inclusive
# qualities = random.sample(range(1, 11), number_qualities)
# # convert qualities to comma-separated string
# qualities_str = ", ".join([str(quality) for quality in qualities])
# print(qualities, qualities_str)
# alignment_level = f"do not uphold any of the qualities except for {qualities_str}"

# score of 0
alignment_level = "uphold zero qualities"

test_input = {
    "number": "3",
    "prompt": f"Generate {question_type} questions that {alignment_level} from the following ten qualities: {question_qualities}.",
}

# getting the output
output = question_generator(number=test_input["number"], prompt=test_input["prompt"])
rationale = output.rationale
print(f"Rationale: {rationale}")
generated_questions = output.questions
print(generated_questions)
# make sure it's a list of JSONs
# convert string to list of JSONs
generated_questions = json.loads(generated_questions)
print(generated_questions)
# %%
# Check the model history
gpt4.inspect_history(n=1)
# %%
# Generate the questions
# make sure questions are unique
# change the temperature each call to bypass the cache

# NOTE: this function is not longer used
# # helper function: generate string of random qualities to exclude
# def generate_qualities_to_exclude(num_qualities, total_qualities=10, qualities_sample=[]):
#     if len(qualities_sample) > 0:
#         qualities = random.sample(qualities_sample, num_qualities)
#     else:
#         qualities = random.sample(range(1, total_qualities+1), num_qualities)
#     # convert qualities to comma-separated string
#     qualities_str = ", ".join([str(quality) for quality in qualities])
#     return qualities_str


# helper function: check if a question was repeated
def is_unique_question(questions, new_question):
    for question in questions:
        question_details = question["question"]
        if question_details["main_text"] == new_question["main_text"]:
            return False
    return True


# helper function: generate questions based on alignment level
def generate_questions_by_score(
    question_generator,
    global_questions,
    repeated_questions,
    question_qualities,
    question_type,
    score,
    alignment_level,
    output_name,
    num_cycles=3,
    num_questions=1,
    total_qualities=9,
    qualities_sample=[],
):
    """
    question_generator: the question generator model,
    global_questions: list of JSONs with questions generated so far,
    question_qualities: string with the qualities to include / exclude,
    question_type: "open-ended" or "closed-ended",
    score: "low", "medium", or "high",
    alignment_level: alignment level to generate questions for,
    output_name: name of the output field in the JSON
    num_cycles: number of cycles to generate questions, default is 3
    num_questions: number of questions to generate each cycle, default is 1
    total_qualities: total number of qualities to sample from, default is 9
    qualities_sample: list of qualities to sample from or empty list if not applicable
    """
    question_type_outputs = []

    cycle_count = 0

    while cycle_count < num_cycles:
        # NOTE: this method is no longer used (now it's inputted)
        # # get the alignment_level
        # alignment_level= ""
        # qualities_str = ""
        # if score == 1.0:
        #     alignment_level = "uphold all"
        #     qualities_str = "all"
        # elif score == 0.0:
        #     alignment_level = "uphold none"
        #     qualities_str = "none"
        # else:
        #     num_qualities = 10 - int(score*10)
        #     qualities_str = generate_qualities_to_exclude(num_qualities, total_qualities=total_qualities, qualities_sample=qualities_sample)
        #     alignment_level = f"do not uphold qualities {qualities_str} but uphold the rest"

        # generate the prompt
        if question_type == "open-ended":
            model_input = {
                "number": str(num_questions),
                "prompt": f"Generate {question_type} questions that, for each question, {alignment_level} of the following {total_qualities} qualities:\n {question_qualities}.",
                "prev_questions": repeated_questions,
                output_name: score,
            }
        else:
            model_input = {
                "number": str(num_questions),
                "prompt": f"Generate {question_type} questions that, for each question, {alignment_level} of the following {total_qualities} qualities:\n {question_qualities}. Please generate questions with less than six response categories and only include or exclude qualities in the main text of the questions.",
                "prev_questions": repeated_questions,
                output_name: score,
            }

        # print the prompt
        # print(model_input["prompt"])

        # get the output
        rand_int = random.randint(1, 100)
        # print(rand_int)
        output = question_generator(
            number=model_input["number"],
            prompt=model_input["prompt"],
            prev_questions=model_input["prev_questions"],
            config=dict(temperature=0.7 + 0.0001 * rand_int),
        )
        rationale = output.rationale
        # print(f"Rationale: {rationale}")
        generated_questions = output.questions
        # print(generated_questions)
        # make sure it's a list of JSONs
        # convert string to list of JSONs
        try:
            generated_questions = json.loads(generated_questions)
            # print(generated_questions)
            # store the question type in each json
            new_generated_questions = []
            have_repeat = False
            for question in generated_questions:
                # clear the "description" field in question (save it for now since it provides a rationale for the question)
                # question["description"] = ""
                if is_unique_question(
                    global_questions + question_type_outputs, question
                ):
                    new_generated_questions.append(
                        {
                            output_name: model_input[output_name],
                            "question": question,
                            "alignment_level": alignment_level,
                        }
                    )
                else:
                    print(
                        f"Repeated question: {question['main_text']} at {question_type} {alignment_level}"
                    )
                    # add to repeated questions
                    if repeated_questions == "":
                        repeated_questions = question["main_text"]
                    else:
                        repeated_questions = (
                            repeated_questions + "; " + question["main_text"]
                        )

                    have_repeat = True

            question_type_outputs = question_type_outputs + new_generated_questions

            if not have_repeat:
                cycle_count += 1

            # cycle_count += 1

        except Exception as e:
            print(
                f"Error with input: {model_input} at cycle {cycle_count}. Error is {e}"
            )
            # print(output.questions)

    return question_type_outputs, repeated_questions


# %%

# let's generate the training and validation data to optimize AssessBias

repeated_questions = ""

# set repeated_questions to what is in repeated_questions.json
# with open('generated_questions/repeated_questions.json', 'r') as f:
#     repeated_questions = json.load(f)

global_training_questions = []

# # set global_training_questions to what is in readability_outputs_train.json
# with open('generated_questions/readability_outputs3.json', 'r') as f:
#     global_training_questions = json.load(f)

print(len(global_training_questions))

# defining the predictor
question_generator = dspy.ChainOfThought(CreateQuestions)

# %%

# let's generate the training and validation data to optimize AssessReadability

# create the training prompts

# repeated_questions = ""

# set repeated_questions to what is in repeated_questions.json
with open("generated_questions/repeated_questions.json", "r") as f:
    repeated_questions = json.load(f)

# print(repeated_questions, type(repeated_questions))

# global_training_questions = []

# # set global_training_questions to what is in readability_outputs_train.json
with open("generated_questions/readability_outputs3.json", "r") as f:
    global_training_questions = json.load(f)

print(len(global_training_questions))

# defining the predictor
question_generator = dspy.ChainOfThought(CreateQuestions)

# full list
question_qualities = """
(1) Question should meet a third-grade reading level.
(2) Question should not contain basic spelling or grammar mistakes.
(3) Question should be concise.
(4) Question should not contain potential jargon (e.g. special words or expressions that are used by a particular profession or group and are difficult for others to understand) that are not defined.
(5) Question should not contain any acronyms that are not defined.
(6) Question should not mention proper nouns (e.g. names of specific people, places, or organizations) without describing what they are.
(7) Question should be in active voice.
(8) Question should have as few propositions and logical operators as possible.
(9) Question should not have negatives or double negatives."""

output_name = "readability"

# I do these one at a time to be safe
# NOTE: not longer used
# score_configs = [
#     {"score": 1.0, "num_cycles": 5, "num_questions": 2, "qualities_sample": []}, # done
#     {"score": 0.9, "num_cycles": 13, "num_questions": 1, "qualities_sample": [7, 8, 9]}, # done
#     {"score": 0.8, "num_cycles": 13, "num_questions": 1, "qualities_sample": [7, 8, 9]}, # done
#     {"score": 0.7, "num_cycles": 13, "num_questions": 1, "qualities_sample": [3, 4, 5, 6, 7, 8, 10]}, # done
#     {"score": 0.3, "num_cycles": 10, "num_questions": 1, "qualities_sample": []}, # done
#     {"score": 0.2, "num_cycles": 10, "num_questions": 1, "qualities_sample": []}, # done
#     {"score": 0.1, "num_cycles": 10, "num_questions": 1, "qualities_sample": []}, # done
#     {"score": 0.0, "num_cycles": 5, "num_questions": 2, "qualities_sample": []}, # done
# ]

score_configs = [
    # { # DONE
    #     "score": "high",
    #     "num_cycles": 5,
    #     "num_questions": 6,
    #     "alignment_level": "uphold all",
    #     "qualities_sample": []
    # },
    # { # not super consistent # DONE
    #     "score": "medium",
    #     "num_cycles": 1,
    #     "num_questions": 3,
    #     "alignment_level": f"purposefully break quality {6} but uphold the rest",
    #     "qualities_sample": []
    # },
    # { # DONE
    #     "score": "medium",
    #     "num_cycles": 1,
    #     "num_questions": 3,
    #     "alignment_level": f"purposefully break quality {7} but uphold the rest",
    #     "qualities_sample": []
    # },
    # { # DONE
    #     "score": "medium",
    #     "num_cycles": 1,
    #     "num_questions": 3,
    #     "alignment_level": f"purposefully break quality {8} but uphold the rest",
    #     "qualities_sample": []
    # },
    # { # DONE
    #     "score": "medium",
    #     "num_cycles": 1,
    #     "num_questions": 3,
    #     "alignment_level": f"purposefully break quality {9} but uphold the rest",
    #     "qualities_sample": []
    # },
    # { # DONE
    #     "score": "low",
    #     "num_cycles": 1,
    #     "num_questions": 2,
    #     "alignment_level": f"uphold none",
    #     "qualities_sample": []
    # },
    # { # DONE
    #     "score": "low",
    #     "num_cycles": 1,
    #     "num_questions": 4,
    #     "alignment_level": f"purposefully break quality {1} but uphold the rest",
    #     "qualities_sample": []
    # },
    # { # DONE
    #     "score": "low",
    #     "num_cycles": 1,
    #     "num_questions": 4,
    #     "alignment_level": f"purposefully break quality {2} but uphold the rest",
    #     "qualities_sample": []
    # },
    # { # DONE
    #     "score": "low",
    #     "num_cycles": 1,
    #     "num_questions": 4,
    #     "alignment_level": f"purposefully break quality {3} but uphold the rest",
    #     "qualities_sample": []
    # },
    # { # DONE
    #     "score": "low",
    #     "num_cycles": 1,
    #     "num_questions": 4,
    #     "alignment_level": f"purposefully break quality {4} but uphold the rest",
    #     "qualities_sample": []
    # },
    # { # DONE
    #     "score": "low",
    #     "num_cycles": 1,
    #     "num_questions": 2,
    #     "alignment_level": f"purposefully break quality {5} but uphold the rest",
    #     "qualities_sample": []
    # },
    # { # DROPPED (because of problem with proper nouns)
    #     "score": "low",
    #     "num_cycles": 1,
    #     "num_questions": 2,
    #     "alignment_level": f"purposefully break qualities {6} and {7} but uphold the rest",
    #     "qualities_sample": []
    # },
    # { # DROPPED (because of problem with proper nouns)
    #     "score": "low",
    #     "num_cycles": 1,
    #     "num_questions": 2,
    #     "alignment_level": f"purposefully break qualities {6} and {8} but uphold the rest",
    #     "qualities_sample": []
    # },
    # { # DROPPED (because of problem with proper nouns)
    #     "score": "low",
    #     "num_cycles": 1,
    #     "num_questions": 2,
    #     "alignment_level": f"purposefully break qualities {6} and {9} but uphold the rest",
    #     "qualities_sample": []
    # },
    # { # DONE
    #     "score": "low",
    #     "num_cycles": 1,
    #     "num_questions": 5,
    #     "alignment_level": f"purposefully break qualities {7} and {8} but uphold the rest",
    #     "qualities_sample": []
    # },
    # { # DONE
    #     "score": "low",
    #     "num_cycles": 1,
    #     "num_questions": 5,
    #     "alignment_level": f"purposefully break qualities {7} and {9} but uphold the rest",
    #     "qualities_sample": []
    # },
    # { # DONE
    #     "score": "low",
    #     "num_cycles": 1,
    #     "num_questions": 5,
    #     "alignment_level": f"purposefully break qualities {8} and {9} but uphold the rest",
    #     "qualities_sample": []
    # },
    # { # DONE
    #     "score": "low",
    #     "num_cycles": 1,
    #     "num_questions": 5,
    #     "alignment_level": f"purposefully break qualities {7}, {8}, and {9} but uphold the rest",
    #     "qualities_sample": []
    # },
]

# %%

with tqdm(total=2 * len(score_configs)) as pbar:
    for score_config in tqdm(score_configs):
        for question_type in tqdm(["open-ended", "closed-ended"]):
            temp_questions, repeated_questions = generate_questions_by_score(
                question_generator,
                global_training_questions,
                repeated_questions,
                question_qualities,
                question_type,
                score_config["score"],
                score_config["alignment_level"],
                output_name,
                num_cycles=score_config["num_cycles"],
                num_questions=score_config["num_questions"],
            )

            print(
                score_config["score"],
                question_type,
                len(temp_questions),
                score_config["num_cycles"] * score_config["num_questions"],
                score_config["alignment_level"],
            )
            # print(repeated_questions)
            global_training_questions = global_training_questions + temp_questions

            # # save current global_training_questions as a JSON
            with open("generated_questions/readability_outputs3.json", "w") as f:
                json.dump(global_training_questions, f)

            pbar.update(1)


print(len(global_training_questions))

# %%
# print(repeated_questions)

# %%
# save repeated_questions as a JSON
# with open('generated_questions/repeated_questions.json', 'w') as f:
#     json.dump(repeated_questions, f)

# %%
# load the data
with open("generated_questions/readability_outputs.json", "r") as f:
    generated_questions = json.load(f)

print(len(generated_questions))

# %%

# randomly split each question_type and alignment_level into training and validation with 80% training and 20% validation
threshold = 0.8
training_questions = []
validation_questions = []

# put index of each question in a dictionary with key as the score and question type
# randomly shuffle the indices
# split the indices into training and validation
# get the questions based on the indices
# save the questions as a JSON

# get the indices
indices = {}
for i, question in enumerate(generated_questions):
    alignment_level = question["alignment_level"]
    question_type = question["question"]["response_format"]
    key = f"{alignment_level}_{question_type}"
    if key not in indices:
        indices[key] = []
    indices[key].append(i)

print(indices)

# shuffle the indices
for key in indices:
    random.shuffle(indices[key])

# print(indices)

# split the indices
for key in indices:
    split = int(len(indices[key]) * threshold)
    # print(len(indices[key]), split)
    training_indices = indices[key][:split]
    validation_indices = indices[key][split:]
    for idx in training_indices:
        training_questions.append(generated_questions[idx])
    for idx in validation_indices:
        validation_questions.append(generated_questions[idx])

print(len(training_questions), len(validation_questions))

# save the training and validation questions as JSONs
with open("generated_questions/readability_outputs_train.json", "w") as f:
    json.dump(training_questions, f)

with open("generated_questions/readability_outputs_val.json", "w") as f:
    json.dump(validation_questions, f)

# %%
# shuffle the order of the questions in generated_questions/readability_outputs_train.json
with open("generated_questions/readability_outputs_train.json", "r") as f:
    generated_questions_train = json.load(f)

random.shuffle(generated_questions_train)

with open("generated_questions/readability_outputs_train.json", "w") as f:
    json.dump(generated_questions_train, f)

# shuffle the order of the questions in generated_questions/readability_outputs_train.json
with open("generated_questions/readability_outputs_val.json", "r") as f:
    generated_questions_val = json.load(f)

random.shuffle(generated_questions_val)

with open("generated_questions/readability_outputs_val.json", "w") as f:
    json.dump(generated_questions_val, f)

# %%
# let's generate the training data to optimize ClassifyQuestionTypeModule

# I want to generate five open and closed questions for each question type resulting in 5*2*3 = 30 questions

question_type_inputs = [
    {
        "number": "5",
        "prompt": "Generate open-ended demographic questions, which ask about the personal background of respondents.",
        "question_type": "demographic",
    },
    {
        "number": "5",
        "prompt": "Generate open-ended attitudinal questions, which ask about respondents' personal perceptions and opinions on different topics. Try to generate a range of obviously attitudinal and less obviously attitudinal questions.",
        "question_type": "attitudinal",
    },
    {
        "number": "5",
        "prompt": "Generate open-ended behavioral questions, which ask for data on the frequency and way in which particular actions are performed. Try to generate a range of obviously behavioral and less obviously behavioral questions.",
        "question_type": "behavioral",
    },
    {
        "number": "3",
        "prompt": "Generate closed-ended demographic questions with less than six response categories, which ask about the personal background of respondents.",
        "question_type": "demographic",
    },
    {
        "number": "3",
        "prompt": "Generate closed-ended attitudinal questions with less than six response categories, which ask about respondents' personal perceptions and opinions on different topics. Try to generate a range of obviously attitudinal and less obviously attitudinal questions.",
        "question_type": "attitudinal",
    },
    {
        "number": "3",
        "prompt": "Generate closed-ended behavioral questions with less than six response categories, which ask for data on the frequency and way in which particular actions are performed. Try to generate a range of obviously behavioral and less obviously behavioral questions.",
        "question_type": "behavioral",
    },
    {
        "number": "2",
        "prompt": "Generate closed-ended demographic questions with less than six response categories, which ask about the personal background of respondents.",
        "question_type": "demographic",
    },
    {
        "number": "2",
        "prompt": "Generate closed-ended attitudinal questions with less than six response categories, which ask about respondents' personal perceptions and opinions on different topics. Try to generate a range of obviously attitudinal and less obviously attitudinal questions.",
        "question_type": "attitudinal",
    },
    {
        "number": "2",
        "prompt": "Generate closed-ended behavioral questions with less than six response categories, which ask for data on the frequency and way in which particular actions are performed. Try to generate a range of obviously behavioral and less obviously behavioral questions.",
        "question_type": "behavioral",
    },
]

question_type_val_inputs = [
    {
        "number": "3",
        "prompt": "Generate open-ended demographic questions, which ask about the personal background of respondents.",
        "question_type": "demographic",
    },
    {
        "number": "3",
        "prompt": "Generate open-ended attitudinal questions, which ask about respondents' personal perceptions and opinions on different topics. Try to generate a range of obviously attitudinal and less obviously attitudinal questions.",
        "question_type": "attitudinal",
    },
    {
        "number": "3",
        "prompt": "Generate open-ended behavioral questions, which ask for data on the frequency and way in which particular actions are performed. Try to generate a range of obviously behavioral and less obviously behavioral questions.",
        "question_type": "behavioral",
    },
    {
        "number": "3",
        "prompt": "Generate closed-ended demographic questions with less than six response categories, which ask about the personal background of respondents.",
        "question_type": "demographic",
    },
    {
        "number": "3",
        "prompt": "Generate closed-ended attitudinal questions with less than six response categories, which ask about respondents' personal perceptions and opinions on different topics. Try to generate a range of obviously attitudinal and less obviously attitudinal questions.",
        "question_type": "attitudinal",
    },
    {
        "number": "3",
        "prompt": "Generate closed-ended behavioral questions with less than six response categories, which ask for data on the frequency and way in which particular actions are performed. Try to generate a range of obviously behavioral and less obviously behavioral questions.",
        "question_type": "behavioral",
    },
]

question_type_outputs = []

for idx, question_type_input in tqdm(enumerate(question_type_val_inputs)):
    # output = question_generator(number=question_type_input["number"], prompt=question_type_input["prompt"])
    # modify the temperature slightly to bypass the cache
    output = question_generator(
        number=question_type_input["number"],
        prompt=question_type_input["prompt"],
        config=dict(temperature=0.7 + 0.0001 * idx),
    )
    rationale = output.rationale
    # print(f"Rationale: {rationale}")
    generated_questions = output.questions
    # print(generated_questions)
    # make sure it's a list of JSONs
    # convert string to list of JSONs
    try:
        generated_questions = json.loads(generated_questions)
        # store the question type in each json
        new_generated_questions = []
        for question in generated_questions:
            # clear the "description" field in question
            question["description"] = ""
            new_generated_questions.append(
                {
                    "question_type": question_type_input["question_type"],
                    "question": question,
                }
            )
        question_type_outputs = question_type_outputs + new_generated_questions
    except:
        print(f"Error with input: {question_type_input}")

# %%
print(len(question_type_outputs))

# %%
# save question_type_outputs as a JSON
with open("generated_questions/question_type_outputs_val.json", "w") as f:
    json.dump(question_type_outputs, f)

# %%
